function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function replaceVariables(value, variables) {
  return String(value || '').replace(/\{\{([a-z_]+)\}\}/g, (match, key) => (
    Object.hasOwn(variables, key) ? String(variables[key] ?? '') : match
  ));
}

export function buildConfiguredVelvetEmail({
  template,
  variables = {},
  ctaUrl,
  logoUrl
}) {
  if (!template) return null;
  const subject = replaceVariables(template.subject, variables);
  const preview = replaceVariables(template.preheader, variables);
  const heading = replaceVariables(template.heading, variables);
  const bodyText = replaceVariables(template.body_text, variables);
  const ctaLabel = replaceVariables(template.cta_label, variables);
  const footerText = replaceVariables(template.footer_text, variables);
  const safeUrl = escapeHtml(ctaUrl || '');
  const safeLogo = escapeHtml(logoUrl || '');
  const paragraphs = bodyText.split(/\n{2,}/).map((paragraph) => (
    `<p style="margin:0 0 16px;color:#d5c8cc;font-size:15px;line-height:1.72">${escapeHtml(paragraph).replaceAll('\n','<br>')}</p>`
  )).join('');
  const cta = ctaLabel && safeUrl
    ? `<a href="${safeUrl}" style="display:inline-block;margin-top:12px;padding:14px 22px;border-radius:999px;background:#641B36;color:#F4F4F2;text-decoration:none;font-weight:700">${escapeHtml(ctaLabel)}</a>`
    : '';
  const logo = safeLogo
    ? `<img src="${safeLogo}" width="58" height="58" alt="Zwit" style="display:block;width:58px;height:58px;border:0;border-radius:18px">`
    : '<strong style="color:#C6A96A;letter-spacing:4px;font-size:18px">ZWIT</strong>';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;padding:0;background:#0D0D0D;color:#F4F4F2;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#0D0D0D"><tr><td align="center" style="padding:34px 14px 46px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px"><tr><td style="padding:0 4px 18px;color:#C6A96A;font-size:10px;letter-spacing:2.4px;text-transform:uppercase">Zwit · message privé · 18+</td></tr><tr><td style="overflow:hidden;border:1px solid #3A3637;border-radius:28px;background:#1B1B1D"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:32px 34px 12px">${logo}</td></tr><tr><td style="padding:16px 34px 0;font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1.08;color:#FFFAF5">${escapeHtml(heading)}</td></tr><tr><td style="padding:24px 34px 16px">${paragraphs}${cta}</td></tr><tr><td style="border-top:1px solid #3A3637;padding:20px 34px 26px;color:#9e9498;font-size:11px;line-height:1.6">${escapeHtml(footerText)}</td></tr></table></td></tr><tr><td align="center" style="padding:20px 18px 0;color:#756970;font-size:10px;line-height:1.6">Zwit — Là où les plus belles rencontres commencent.</td></tr></table>
    </td></tr></table>
  </body></html>`;
  return {
    subject,
    preview,
    text: [heading, '', bodyText, '', ctaLabel && ctaUrl ? `${ctaLabel} : ${ctaUrl}` : '', '', footerText]
      .filter((line) => line !== '')
      .join('\n'),
    html
  };
}

export function buildCoupleInvitationEmail({ profileName, registrationUrl }) {
  const safeName = escapeHtml(profileName || 'Votre moitié');
  const safeUrl = escapeHtml(registrationUrl);
  const subject = 'Votre moitié vous attend dans Zwit';
  const preview = 'Une part de votre histoire a déjà été confiée. À vous de poursuivre.';
  const text = [
    'ZWIT — INVITATION PRIVÉE',
    '',
    'Votre histoire vous attend.',
    '',
    `${profileName || 'Votre moitié'} a entrouvert la porte de votre espace Velvet.`,
    'Une première part de votre histoire y a déjà été confiée. Il ne manque plus que votre voix.',
    '',
    'Ce lien est personnel. Il vous conduit vers votre propre espace, afin de raconter qui vous êtes, à votre rythme.',
    'Votre fiche personnelle vous appartient. La partie commune du couple se construira à deux.',
    '',
    `Poursuivre notre histoire : ${registrationUrl}`,
    '',
    'Le lien reste valable pendant 7 jours et ne doit pas être partagé.',
    '',
    'Si vous n’attendiez pas cette invitation, vous pouvez simplement ignorer cet e-mail.',
    '',
    'Zwit — BETA privée · 18+'
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#090708;color:#f6eee6;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#090708;">
    <tr>
      <td align="center" style="padding:34px 14px 46px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;">
          <tr>
            <td style="padding:0 4px 18px;color:#d9b879;font-size:10px;line-height:1.4;letter-spacing:2.4px;text-transform:uppercase;">Zwit · Invitation privée · 18+</td>
          </tr>
          <tr>
            <td style="overflow:hidden;border:1px solid #3d2931;border-radius:28px;background:#171014;background-image:radial-gradient(circle at 90% 5%,rgba(217,184,121,.12),transparent 190px),radial-gradient(circle at 5% 95%,rgba(126,32,69,.28),transparent 230px);box-shadow:0 24px 70px rgba(0,0,0,.36);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:34px 34px 10px;">
                    <div style="width:54px;height:54px;border-radius:17px;background:#7e2045;color:#f6eee6;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:54px;text-align:center;box-shadow:0 12px 30px rgba(126,32,69,.34);">V</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 34px 0;color:#d9b879;font-size:10px;line-height:1.4;letter-spacing:2.1px;text-transform:uppercase;">Une invitation de ${safeName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 34px 0;font-family:Georgia,'Times New Roman',serif;font-size:45px;line-height:1.05;font-weight:400;color:#fff7ef;">Votre histoire<br>vous attend.</td>
                </tr>
                <tr>
                  <td style="padding:24px 34px 0;color:#dbd0d3;font-size:16px;line-height:1.72;">
                    ${safeName} a entrouvert la porte de votre espace Velvet. Une première part de votre histoire y a déjà été confiée. <strong style="color:#fff7ef;font-weight:600;">Il ne manque plus que votre voix.</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 34px 0;color:#bfb2b7;font-size:14px;line-height:1.68;">
                    Ce lien est personnel. Il vous conduit vers votre propre espace, afin de raconter qui vous êtes, à votre rythme. Votre fiche personnelle vous appartient ; la partie commune du couple se construira à deux.
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 34px 8px;">
                    <a href="${safeUrl}" style="display:inline-block;min-width:220px;padding:15px 24px;border-radius:999px;background:#9f2852;color:#ffffff;text-decoration:none;text-align:center;font-size:15px;line-height:1.3;font-weight:700;box-shadow:0 12px 30px rgba(126,32,69,.3);">Poursuivre notre histoire</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:17px 34px 30px;color:#a79a9f;font-size:12px;line-height:1.6;">
                    Le lien reste valable pendant 7 jours et ne doit pas être partagé.
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #35242b;padding:22px 34px 27px;color:#887c81;font-size:11px;line-height:1.55;">
                    Si vous n’attendiez pas cette invitation, ignorez simplement cet e-mail. Aucune fiche ne sera créée sans votre action et vos consentements.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 18px 0;color:#72686c;font-size:10px;line-height:1.6;">
              Zwit — BETA privée · Une expérience réservée aux personnes majeures
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, preview, text, html };
}
