-- Zwit — cohérence de marque visible.
-- Les identifiants techniques historiques restent inchangés ; seules les valeurs destinées aux utilisateurs sont migrées.

update public.control_email_templates
set
  label = replace(replace(replace(label, 'VELVET', 'ZWIT'), 'Velvet', 'Zwit'), 'velvet', 'zwit'),
  subject = replace(replace(replace(subject, 'VELVET', 'ZWIT'), 'Velvet', 'Zwit'), 'velvet', 'zwit'),
  preheader = replace(replace(replace(preheader, 'VELVET', 'ZWIT'), 'Velvet', 'Zwit'), 'velvet', 'zwit'),
  heading = replace(replace(replace(heading, 'VELVET', 'ZWIT'), 'Velvet', 'Zwit'), 'velvet', 'zwit'),
  body_text = replace(replace(replace(body_text, 'VELVET', 'ZWIT'), 'Velvet', 'Zwit'), 'velvet', 'zwit'),
  cta_label = replace(replace(replace(cta_label, 'VELVET', 'ZWIT'), 'Velvet', 'Zwit'), 'velvet', 'zwit'),
  footer_text = replace(replace(replace(footer_text, 'VELVET', 'ZWIT'), 'Velvet', 'Zwit'), 'velvet', 'zwit'),
  updated_at = now()
where concat_ws(' ', label, subject, preheader, heading, body_text, cta_label, footer_text) ~* '\mvelvet\M';

-- Valeurs canoniques des quatre modèles livrés avec Contrôle.
update public.control_email_templates set
  label = 'Invitation de la moitié',
  subject = 'Votre moitié vous attend dans Zwit',
  preheader = 'Une part de votre histoire a déjà été confiée. À vous de poursuivre.',
  heading = 'Votre histoire vous attend.',
  body_text = '{{profile_name}} a entrouvert la porte de votre espace Zwit. Une première part de votre histoire y a déjà été confiée. Il ne manque plus que votre voix.\n\nCe lien est personnel et vous conduit vers votre propre espace. Votre fiche personnelle vous appartient ; la partie commune du couple se construira à deux.',
  cta_label = 'Poursuivre notre histoire',
  footer_text = 'Lien personnel valable 7 jours. Si vous n’attendiez pas cette invitation, ignorez simplement cet e-mail.',
  updated_at = now()
where template_key = 'couple_invitation';

update public.control_email_templates set
  subject = 'Confirmer la mise en pause de votre profil Zwit',
  preheader = 'Une confirmation de sécurité est nécessaire.',
  heading = 'Confirmer la mise en pause',
  body_text = 'Une demande de mise en pause a été créée pour le profil « {{profile_name}} ». Le profil deviendra invisible dès que chaque membre actif de la fiche aura confirmé.',
  cta_label = 'Vérifier et confirmer',
  footer_text = 'Lien personnel valable 48 heures. Ne le partagez pas.',
  updated_at = now()
where template_key = 'account_pause_confirmation';

update public.control_email_templates set
  subject = 'Confirmer la suppression de votre profil Zwit',
  preheader = 'Une confirmation de sécurité est nécessaire.',
  heading = 'Confirmer la suppression',
  body_text = 'Une demande de suppression a été créée pour le profil « {{profile_name}} ». Le profil deviendra invisible après les confirmations, puis les données seront supprimées définitivement 30 jours plus tard.',
  cta_label = 'Vérifier et confirmer',
  footer_text = 'Lien personnel valable 48 heures. Ne le partagez pas.',
  updated_at = now()
where template_key = 'account_deletion_confirmation';

update public.control_email_templates set
  label = 'Annonce du lancement Zwit',
  subject = 'Zwit ouvre bientôt ses portes',
  preheader = 'Là où les plus belles rencontres commencent.',
  heading = 'Une nouvelle expérience commence.',
  body_text = 'Zwit réunit les membres et les professionnels dans une expérience élégante, confidentielle et pensée autour du consentement. Vous recevez cet e-mail parce que vous avez accepté les actualités Zwit.',
  cta_label = 'Découvrir Zwit',
  footer_text = 'Vous pouvez retirer votre consentement marketing à tout moment depuis vos paramètres ou utiliser le lien de désinscription.',
  updated_at = now()
where template_key = 'marketing_launch';
