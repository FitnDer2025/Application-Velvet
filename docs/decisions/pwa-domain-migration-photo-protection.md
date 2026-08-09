# Zwit — PWA, migration de domaine et protection des photos

## Décisions figées

- L’icône iPhone utilise un `apple-touch-icon` PNG 180 × 180.
- Le manifeste PWA utilise une icône PNG 192 × 192 et conserve le monogramme SVG maskable.
- Les notifications iPhone sont activées uniquement depuis Zwit installé sur l’écran d’accueil, après une action explicite de l’utilisateur.
- Une migration de domaine change l’origine de la PWA et de son abonnement Push. Chaque appareil devra donc réautoriser les notifications une fois après la bascule vers le domaine privé.
- Le secret Cloudflare `VAPID_PUBLIC_KEY` et la clé privée d’envoi devront être finalisés avant l’ouverture de la BETA aux invités.

## Protection des photos

- Toute nouvelle photo envoyée depuis l’interface Zwit reçoit un filigrane Zwit directement dans ses pixels avant l’enregistrement.
- Les photos déjà présentes reçoivent également un filigrane d’affichage avec un code de consultation pseudonyme.
- Le glisser-déposer et le menu contextuel d’enregistrement sont désactivés dans l’interface.
- Ces mesures découragent et permettent de mieux tracer une réutilisation, mais ne peuvent pas empêcher une photographie de l’écran avec un autre appareil.

## Capture d’écran

Une PWA et un site web ne disposent pas d’une API fiable pour savoir qu’une capture d’écran système a été prise sur iOS ou Android. Les événements de perte de focus ou de visibilité ne doivent jamais être utilisés comme preuve, car ils produisent de nombreux faux positifs.

La fonctionnalité suivante est donc réservée à la future application native :

1. écouter l’événement système natif de capture d’écran ;
2. enregistrer l’identifiant de la photo affichée, le compte ayant consulté et l’horodatage ;
3. prévenir le propriétaire de la photo ;
4. afficher immédiatement à l’auteur de la capture que le propriétaire a été prévenu ;
5. documenter ce traitement dans la politique de confidentialité et limiter la conservation de l’événement.

Aucune alerte de capture ne doit être simulée dans la version web.
