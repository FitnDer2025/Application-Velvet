import {
  boundedInteger,
  clampProbability,
  cleanAgentText,
  generateAgentReply,
  isInternalTestEnvironment,
  nextRunDelayMinutes,
  SAFE_REACTIONS
} from './test-agent-ai.mjs';

export {
  buildAgentPrompt,
  extractResponseText,
  isInternalTestEnvironment,
  nextRunDelayMinutes
} from './test-agent-ai.mjs';

async function claimAgents(pool, limit = 4) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const settings = await client.query(
      `SELECT enabled
       FROM public.internal_test_agent_settings
       WHERE singleton=true
       FOR SHARE`
    );
    if (!settings.rows[0]?.enabled) {
      await client.query('COMMIT');
      return [];
    }
    const agents = await client.query(
      `SELECT id,user_id,profile_id,display_name,persona,behavior,next_run_at,last_run_at
       FROM public.internal_test_agents
       WHERE status='active' AND next_run_at<=now()
       ORDER BY next_run_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    if (agents.rowCount) {
      await client.query(
        `UPDATE public.internal_test_agents
         SET next_run_at=now()+interval '5 minutes',updated_at=now()
         WHERE id=ANY($1::uuid[])`,
        [agents.rows.map((agent) => agent.id)]
      );
    }
    await client.query('COMMIT');
    return agents.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    if (String(error.code) === '42P01') return [];
    throw error;
  } finally {
    client.release();
  }
}

async function pendingConversation(pool, agent) {
  const delayMinutes = boundedInteger(agent.behavior?.response_delay_minutes, 4, 0, 180);
  const result = await pool.query(
    `SELECT c.id,
            latest.id AS latest_message_id,
            latest.created_at AS latest_message_at,
            latest.sender_user_id,
            target_profile.id AS target_profile_id,
            target_profile.display_name AS target_display_name,
            target_profile.city AS target_city
     FROM public.conversation_members own
     JOIN public.conversations c ON c.id=own.conversation_id
     JOIN LATERAL (
       SELECT m.id,m.sender_user_id,m.created_at
       FROM public.messages m
       WHERE m.conversation_id=c.id AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 1
     ) latest ON true
     LEFT JOIN public.direct_conversation_profiles dcp ON dcp.conversation_id=c.id
     LEFT JOIN public.member_profiles target_profile
       ON target_profile.id=CASE
         WHEN dcp.profile_a_id=$2 THEN dcp.profile_b_id
         ELSE dcp.profile_a_id
       END
     WHERE own.user_id=$1
       AND own.left_at IS NULL
       AND target_profile.id IS NOT NULL
       AND (
         target_profile.is_internal_test_agent
         OR EXISTS (
           SELECT 1
           FROM public.profile_members target_member
           JOIN public.internal_test_agent_viewers viewer
             ON viewer.user_id=target_member.user_id AND viewer.enabled
           WHERE target_member.profile_id=target_profile.id
             AND target_member.status='active'
         )
       )
       AND latest.sender_user_id<>$1
       AND latest.created_at<=now()-make_interval(mins=>$3)
       AND NOT EXISTS (
         SELECT 1
         FROM public.internal_test_agent_conversation_state state
         WHERE state.agent_id=$4
           AND state.conversation_id=c.id
           AND state.last_processed_message_id=latest.id
       )
     ORDER BY latest.created_at
     LIMIT 1`,
    [agent.user_id, agent.profile_id, delayMinutes, agent.id]
  );
  return result.rows[0] || null;
}

async function conversationTranscript(pool, agent, conversationId) {
  const result = await pool.query(
    `SELECT m.id,m.sender_user_id,m.sender_identity,m.body,m.created_at,
            (m.sender_user_id=$2) AS is_agent
     FROM public.messages m
     WHERE m.conversation_id=$1 AND m.deleted_at IS NULL
     ORDER BY m.created_at DESC
     LIMIT 24`,
    [conversationId, agent.user_id]
  );
  return result.rows.reverse();
}

async function saveAgentMessage(pool, agent, conversation, body) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saved = await client.query(
      `INSERT INTO public.messages (
         conversation_id,sender_user_id,sender_identity,body
       ) VALUES ($1,$2,$3,$4)
       RETURNING id,created_at`,
      [conversation.id, agent.user_id, agent.display_name, body]
    );
    await client.query(
      `UPDATE public.conversations SET updated_at=$2 WHERE id=$1`,
      [conversation.id, saved.rows[0].created_at]
    );
    await client.query(
      `UPDATE public.conversation_members
       SET last_delivered_at=now(),last_read_at=now()
       WHERE conversation_id=$1 AND user_id=$2`,
      [conversation.id, agent.user_id]
    );
    await client.query(
      `INSERT INTO public.internal_test_agent_conversation_state (
         agent_id,conversation_id,last_processed_message_id,updated_at
       ) VALUES ($1,$2,$3,now())
       ON CONFLICT (agent_id,conversation_id) DO UPDATE SET
         last_processed_message_id=excluded.last_processed_message_id,
         updated_at=now()`,
      [agent.id, conversation.id, conversation.latest_message_id]
    );
    await client.query(
      `INSERT INTO public.internal_test_agent_runs (
         agent_id,run_type,status,entity_type,entity_id,completed_at,metadata
       ) VALUES ($1,'conversation_reply','completed','conversation',$2,now(),$3::jsonb)`,
      [agent.id, conversation.id, JSON.stringify({ generated: true })]
    );
    await client.query(
      `INSERT INTO public.audit_events (
         actor_user_id,actor_type,action,entity_type,entity_id,metadata
       ) VALUES ($1,'ai_agent','internal_test_agent_message_sent','conversation',$2,$3::jsonb)`,
      [agent.user_id, conversation.id, JSON.stringify({ agent_id: agent.id })]
    );
    await client.query('COMMIT');
    return saved.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function eligibleTarget(pool, agent) {
  const result = await pool.query(
    `SELECT DISTINCT mp.id,mp.display_name,mp.city,mp.profile_type,mp.description
     FROM public.member_profiles mp
     LEFT JOIN public.internal_test_agents other_agent
       ON other_agent.profile_id=mp.id AND other_agent.status<>'retired'
     WHERE mp.id<>$1
       AND mp.admission_status='approved'
       AND mp.visibility IN ('beta_members','published')
       AND (
         other_agent.id IS NOT NULL
         OR EXISTS (
           SELECT 1
           FROM public.profile_members pm
           JOIN public.internal_test_agent_viewers viewer
             ON viewer.user_id=pm.user_id AND viewer.enabled
           WHERE pm.profile_id=mp.id AND pm.status='active'
         )
       )
       AND NOT EXISTS (
         SELECT 1
         FROM public.profile_members target_member
         JOIN public.blocks b ON (
           b.blocker_user_id=$2 AND b.blocked_user_id=target_member.user_id
         ) OR (
           b.blocked_user_id=$2 AND b.blocker_user_id=target_member.user_id
         )
         WHERE target_member.profile_id=mp.id AND target_member.status='active'
       )
     ORDER BY md5(mp.id::text||$3::text||current_date::text)
     LIMIT 1`,
    [agent.profile_id, agent.user_id, agent.id]
  );
  return result.rows[0] || null;
}

async function recordProfileView(pool, agent, target) {
  await pool.query(
    `INSERT INTO public.profile_view_history (
       viewer_user_id,viewer_profile_id,viewed_profile_id,
       first_viewed_at,last_viewed_at,view_count
     ) VALUES ($1,$2,$3,now(),now(),1)
     ON CONFLICT (viewer_user_id,viewed_profile_id) DO UPDATE SET
       viewer_profile_id=excluded.viewer_profile_id,
       last_viewed_at=now(),
       view_count=public.profile_view_history.view_count+1`,
    [agent.user_id, agent.profile_id, target.id]
  );
  await pool.query(
    `INSERT INTO public.internal_test_agent_runs (
       agent_id,run_type,status,entity_type,entity_id,completed_at
     ) VALUES ($1,'profile_view','completed','member_profile',$2,now())`,
    [agent.id, target.id]
  );
}

async function maybeFavorite(pool, agent, target) {
  if (Math.random() > clampProbability(agent.behavior?.favorite_probability, 0.2)) return false;
  await pool.query(
    `INSERT INTO public.favorites (owner_user_id,profile_id)
     VALUES ($1,$2)
     ON CONFLICT (owner_user_id,profile_id) DO NOTHING`,
    [agent.user_id, target.id]
  );
  await pool.query(
    `INSERT INTO public.internal_test_agent_runs (
       agent_id,run_type,status,entity_type,entity_id,completed_at
     ) VALUES ($1,'favorite','completed','member_profile',$2,now())`,
    [agent.id, target.id]
  );
  return true;
}

async function maybeProfileReaction(pool, agent, target) {
  if (Math.random() > clampProbability(agent.behavior?.profile_reaction_probability, 0.35)) return false;
  const reaction = [1, 2, 3][Math.floor(Math.random() * 3)];
  await pool.query(
    `INSERT INTO public.profile_reactions (
       reactor_user_id,reactor_profile_id,target_profile_id,reaction,created_at,updated_at
     ) VALUES ($1,$2,$3,$4,now(),now())
     ON CONFLICT (reactor_user_id,target_profile_id) DO UPDATE SET
       reactor_profile_id=excluded.reactor_profile_id,
       reaction=excluded.reaction,
       updated_at=now()`,
    [agent.user_id, agent.profile_id, target.id, reaction]
  );
  await pool.query(
    `INSERT INTO public.internal_test_agent_runs (
       agent_id,run_type,status,entity_type,entity_id,completed_at,metadata
     ) VALUES ($1,'profile_reaction','completed','member_profile',$2,now(),$3::jsonb)`,
    [agent.id, target.id, JSON.stringify({ reaction })]
  );
  return true;
}

async function maybePhotoReaction(pool, agent, target) {
  if (Math.random() > clampProbability(agent.behavior?.photo_reaction_probability, 0.4)) return false;
  const media = await pool.query(
    `SELECT ma.id
     FROM public.media_assets ma
     LEFT JOIN public.albums a ON a.id=ma.album_id
     WHERE ma.profile_id=$1
       AND ma.moderation_status='approved'
       AND ma.visibility='profile'
       AND (ma.album_id IS NULL OR a.confidentiality='public')
     ORDER BY md5(ma.id::text||$2::text||current_date::text)
     LIMIT 1`,
    [target.id, agent.id]
  );
  if (!media.rows[0]) return false;
  const reaction = SAFE_REACTIONS[Math.floor(Math.random() * SAFE_REACTIONS.length)];
  await pool.query(
    `INSERT INTO public.photo_reactions (
       media_id,reactor_user_id,reactor_profile_id,reaction,created_at,updated_at
     ) VALUES ($1,$2,$3,$4,now(),now())
     ON CONFLICT (media_id,reactor_user_id) DO UPDATE SET
       reactor_profile_id=excluded.reactor_profile_id,
       reaction=excluded.reaction,
       updated_at=now()`,
    [media.rows[0].id, agent.user_id, agent.profile_id, reaction]
  );
  await pool.query(
    `INSERT INTO public.internal_test_agent_runs (
       agent_id,run_type,status,entity_type,entity_id,completed_at,metadata
     ) VALUES ($1,'photo_reaction','completed','media_asset',$2,now(),$3::jsonb)`,
    [agent.id, media.rows[0].id, JSON.stringify({ reaction })]
  );
  return true;
}

async function maybeOpenConversation(pool, env, agent, target) {
  if (Math.random() > clampProbability(agent.behavior?.conversation_open_probability, 0.08)) return false;
  const existing = await pool.query(
    `SELECT dcp.conversation_id
     FROM public.direct_conversation_profiles dcp
     WHERE (dcp.profile_a_id=$1 AND dcp.profile_b_id=$2)
        OR (dcp.profile_a_id=$2 AND dcp.profile_b_id=$1)
     LIMIT 1`,
    [agent.profile_id, target.id]
  );
  if (existing.rows[0]) return false;

  const conversation = await pool.query(
    `SELECT public.internal_test_agent_open_conversation($1,$2) AS id`,
    [agent.user_id, target.id]
  );
  const conversationId = conversation.rows[0]?.id;
  if (!conversationId) return false;
  const opener = await generateAgentReply(env, agent, [], target);
  await pool.query(
    `INSERT INTO public.messages (
       conversation_id,sender_user_id,sender_identity,body
     ) VALUES ($1,$2,$3,$4)`,
    [conversationId, agent.user_id, agent.display_name, opener]
  );
  await pool.query(
    `UPDATE public.conversations SET updated_at=now() WHERE id=$1`,
    [conversationId]
  );
  await pool.query(
    `INSERT INTO public.internal_test_agent_runs (
       agent_id,run_type,status,entity_type,entity_id,completed_at
     ) VALUES ($1,'conversation_open','completed','conversation',$2,now())`,
    [agent.id, conversationId]
  );
  return true;
}

async function performAmbientActions(pool, env, agent) {
  const target = await eligibleTarget(pool, agent);
  if (!target) return { acted: false, reason: 'no_internal_target' };
  if (Math.random() <= clampProbability(agent.behavior?.profile_view_probability, 0.8)) {
    await recordProfileView(pool, agent, target);
  }
  const [favorite, profileReaction, photoReaction, conversationOpened] = await Promise.all([
    maybeFavorite(pool, agent, target),
    maybeProfileReaction(pool, agent, target),
    maybePhotoReaction(pool, agent, target),
    maybeOpenConversation(pool, env, agent, target)
  ]);
  return {
    acted: true,
    targetProfileId: target.id,
    favorite,
    profileReaction,
    photoReaction,
    conversationOpened
  };
}

async function finishAgent(pool, agent, error = null) {
  const delay = nextRunDelayMinutes(agent.behavior || {});
  await pool.query(
    `UPDATE public.internal_test_agents
     SET last_run_at=now(),
         next_run_at=now()+make_interval(mins=>$2),
         last_error_code=$3,
         updated_at=now()
     WHERE id=$1`,
    [agent.id, delay, error ? cleanAgentText(error.message || error, 120) : null]
  );
  if (error) {
    await pool.query(
      `INSERT INTO public.internal_test_agent_runs (
         agent_id,run_type,status,error_code,completed_at
       ) VALUES ($1,'error','failed',$2,now())`,
      [agent.id, cleanAgentText(error.message || error, 120)]
    ).catch(() => null);
  }
}

async function runAgent(pool, env, agent) {
  try {
    const conversation = await pendingConversation(pool, agent);
    if (conversation) {
      const messages = await conversationTranscript(pool, agent, conversation.id);
      const reply = await generateAgentReply(env, agent, messages, {
        id: conversation.target_profile_id,
        display_name: conversation.target_display_name,
        city: conversation.target_city
      });
      await saveAgentMessage(pool, agent, conversation, reply);
      await finishAgent(pool, agent);
      return { agentId: agent.id, action: 'conversation_reply' };
    }

    const ambient = await performAmbientActions(pool, env, agent);
    await finishAgent(pool, agent);
    return { agentId: agent.id, action: 'ambient', ...ambient };
  } catch (error) {
    await finishAgent(pool, agent, error).catch(() => null);
    return { agentId: agent.id, action: 'error', error: cleanAgentText(error.message, 120) };
  }
}

export async function runInternalTestAgents(pool, env = process.env) {
  if (!isInternalTestEnvironment(env)) return { enabled: false, processed: 0, results: [] };
  const agents = await claimAgents(pool, boundedInteger(env.VELVET_TEST_AGENT_BATCH_SIZE, 4, 1, 12));
  const results = [];
  for (const agent of agents) results.push(await runAgent(pool, env, agent));
  return { enabled: true, processed: agents.length, results };
}
