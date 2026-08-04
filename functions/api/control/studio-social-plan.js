const TEXT_MODEL = '@cf/zai-org/glm-4.7-flash';
const FORMATS = new Set(['9:16', '1:1', '16:9']);

const MEMBER_SCREENS = ['home', 'discover', 'profile', 'messages', 'events', 'map'];
const PRO_SCREENS = ['pro_dashboard', 'pro_venue', 'pro_events', 'pro_bookings'];

function clean(value, max = 1400) {
  return String(value ?? '').trim().slice(0, max);
}

function integer(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function modelText(result) {
  return typeof result === 'string' ? result : result?.response || result?.result?.response || result?.choices?.[0]?.message?.content || result?.choices?.[0]?.text || '';
}

function memberFallback(brief, duration, format) {
  const screens = duration >= 30 ? MEMBER_SCREENS : ['home', 'discover', 'profile', 'events'];
  const copy = {
    home: ['Une envie que l’on gardait pour soi', 'Tout commence par une envie.', 'Il y a des envies que l’on garde longtemps pour soi. Puis vient le moment de les découvrir autrement.', 'mystère'],
    discover: ['Un univers retient le regard', 'Une intuition. Une possibilité.', 'Sur Velvet, chaque profil raconte une personnalité, une histoire et une façon unique de vivre les rencontres.', 'attirance'],
    profile: ['Prendre le temps de découvrir', 'Derrière le profil, une histoire.', 'Quelques mots, des envies partagées et cette impression subtile que quelque chose pourrait commencer.', 'émotion'],
    messages: ['Les premiers mots', 'Le feeling commence ici.', 'Alors un premier message est envoyé. Sans pression. Avec cette élégance qui laisse doucement la place au feeling.', 'connexion'],
    events: ['Quand l’échange devient une promesse', 'Une soirée commence à se dessiner.', 'La conversation devient une invitation. Une sortie se prépare. L’imaginaire laisse enfin place à une expérience réelle.', 'projection'],
    map: ['Tout devient plus proche', 'Les rencontres et les lieux autour de vous.', 'Velvet rapproche les personnes, les événements et les établissements qui partagent la même envie de vivre quelque chose de vrai.', 'désir']
  };
  const sceneDuration = duration / screens.length;
  return {
    product: 'member', title: 'Une envie devient une histoire', format, duration, brief,
    narrativeArc: 'mystère → attirance → émotion → connexion → projection → désir de rejoindre Velvet',
    closingLine: 'Velvet. Là où les plus belles rencontres commencent.',
    scenes: screens.map((screen, index) => ({
      screen, action: screen, title: copy[screen][0], onScreen: copy[screen][1], voice: copy[screen][2], emotion: copy[screen][3], duration: sceneDuration, beat: index + 1
    }))
  };
}

function proFallback(brief, duration, format) {
  const screens = PRO_SCREENS;
  const copy = {
    pro_dashboard: ['Un lieu mérite plus qu’une simple présence', 'Votre activité, enfin lisible.', 'Chaque soirée demande de l’énergie. Velvet Pro transforme cette énergie en une vision claire, élégante et immédiatement exploitable.', 'maîtrise'],
    pro_venue: ['Votre univers prend toute sa valeur', 'Une vitrine à votre image.', 'Votre établissement se raconte avec justesse. Son ambiance, ses services et sa singularité deviennent visibles auprès d’une communauté déjà engagée.', 'fierté'],
    pro_events: ['Chaque soirée trouve son public', 'Créer. Publier. Remplir.', 'Vous préparez vos événements, choisissez votre audience et donnez envie de réserver, depuis un seul espace pensé pour votre métier.', 'impact'],
    pro_bookings: ['Vous gardez toujours une longueur d’avance', 'Les inscriptions sous contrôle.', 'Les réservations, les participants et les arrivées sont réunis au même endroit. Moins d’incertitude, plus de temps pour l’expérience que vous offrez.', 'sérénité']
  };
  const sceneDuration = duration / screens.length;
  return {
    product: 'pro', title: 'Votre établissement monte d’un cran', format, duration, brief,
    narrativeArc: 'charge quotidienne → maîtrise → visibilité → impact → sérénité → envie de rejoindre Velvet Pro',
    closingLine: 'Velvet Pro. Donnez à votre établissement la visibilité qu’il mérite.',
    scenes: screens.map((screen, index) => ({
      screen, action: screen, title: copy[screen][0], onScreen: copy[screen][1], voice: copy[screen][2], emotion: copy[screen][3], duration: sceneDuration, beat: index + 1
    }))
  };
}

function fallback(product, brief, duration, format) {
  return product === 'pro' ? proFallback(brief, duration, format) : memberFallback(brief, duration, format);
}

function parse(raw, product, brief, duration, format) {
  const backup = fallback(product, brief, duration, format);
  const source = clean(raw, 20000);
  const match = source.match(/\{[\s\S]*\}/);
  if (!match) return backup;
  try {
    const parsed = JSON.parse(match[0]);
    const required = product === 'pro'
      ? PRO_SCREENS
      : (duration >= 30 ? MEMBER_SCREENS : ['home', 'discover', 'profile', 'events']);
    const allowed = new Set(required);
    const generated = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    const byScreen = new Map(generated.filter((scene) => allowed.has(scene.screen)).map((scene) => [scene.screen, scene]));
    const backupByScreen = new Map(backup.scenes.map((scene) => [scene.screen, scene]));
    const sceneDuration = duration / required.length;
    const scenes = required.map((screen, index) => {
      const value = byScreen.get(screen) || {};
      const safe = backupByScreen.get(screen);
      return {
        screen,
        action: screen,
        title: clean(value.title || safe.title, 110),
        onScreen: clean(value.onScreen || value.text || safe.onScreen, 120),
        voice: clean(value.voice || safe.voice, 260),
        emotion: clean(value.emotion || safe.emotion, 50),
        duration: sceneDuration,
        beat: index + 1
      };
    });
    return {
      product,
      title: clean(parsed.title || backup.title, 120),
      format,
      duration,
      brief,
      narrativeArc: clean(parsed.narrativeArc || backup.narrativeArc, 220),
      closingLine: clean(parsed.closingLine || backup.closingLine, 180),
      scenes
    };
  } catch {
    return backup;
  }
}

function memberSystem() {
  return [
    'Tu es la réalisatrice d’une publicité française premium pour Velvet Membre.',
    'La vidéo montre uniquement la véritable interface Velvet en action : accueil, découverte, profil, messages, sorties et carte.',
    'Tu racontes une histoire sensuelle, émotionnelle et élégante qui donne envie de rejoindre Velvet.',
    'La sensualité vient du mystère, des mots, de la confiance, du feeling et de la projection. Jamais de contenu explicite ou vulgaire.',
    'Chaque phrase doit correspondre précisément à l’écran réel affiché.',
    'Écrans autorisés : home, discover, profile, messages, events, map.',
    'La voix est française, féminine, chaleureuse, naturelle, composée de phrases courtes et fluides.',
    'Ne dis jamais fonctionnalité, utilisateur, filtre, algorithme ou application.',
    'Réponds uniquement avec un objet JSON valide.'
  ].join(' ');
}

function proSystem() {
  return [
    'Tu es la réalisatrice d’une publicité française premium pour Velvet Pro.',
    'La vidéo montre uniquement la véritable interface Velvet Pro en action : tableau de bord, établissement, événements et inscriptions.',
    'Tu racontes l’histoire d’un professionnel qui retrouve visibilité, maîtrise et sérénité.',
    'Le récit doit être humain, élégant, concret et donner envie de souscrire, sans jargon logiciel.',
    'Chaque phrase doit correspondre précisément à l’écran réel affiché.',
    'Écrans autorisés : pro_dashboard, pro_venue, pro_events, pro_bookings.',
    'La voix est française, féminine, chaleureuse, naturelle, composée de phrases courtes et fluides.',
    'Ne dis jamais CRM, interface utilisateur, algorithme, back-office ou solution SaaS.',
    'Réponds uniquement avec un objet JSON valide.'
  ].join(' ');
}

export async function generateSocialPlan(env, body) {
  const product = body.product === 'pro' ? 'pro' : 'member';
  const brief = clean(body.brief || body.prompt, 1400);
  const duration = integer(body.duration, 15, 45, 30);
  const format = FORMATS.has(body.format) ? body.format : '9:16';
  const backup = fallback(product, brief, duration, format);
  const screens = product === 'pro' ? PRO_SCREENS : (duration >= 30 ? MEMBER_SCREENS : ['home', 'discover', 'profile', 'events']);
  const system = product === 'pro' ? proSystem() : memberSystem();
  const user = [
    `Produit : ${product === 'pro' ? 'Velvet Pro' : 'Velvet Membre'}.`,
    `Durée : ${duration} secondes. Format : ${format}.`,
    `Écrans obligatoires dans cet ordre : ${screens.join(', ')}.`,
    `Brief : ${brief || backup.brief}.`,
    'Structure attendue : {"title":"...","narrativeArc":"...","closingLine":"...","scenes":[{"screen":"...","title":"...","onScreen":"...","voice":"...","emotion":"..."}]}.'
  ].join(' ');
  try {
    const result = await env.AI.run(TEXT_MODEL, {
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_completion_tokens: 1800,
      temperature: 0.7,
      top_p: 0.9
    });
    return parse(modelText(result), product, brief, duration, format);
  } catch {
    return backup;
  }
}

export const SOCIAL_TEXT_MODEL = TEXT_MODEL;
