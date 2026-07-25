import {
  LegalDocument,
  LegalSection,
  LegalText,
} from "@/components/legal-document";
import { LEGAL_ENTITY, PRIVACY_VERSION } from "@/constants/legal";

export default function PrivacyScreen() {
  return (
    <LegalDocument
      title="POLITIQUE DE CONFIDENTIALITÉ"
      headerTitle="Confidentialité"
      version={PRIVACY_VERSION}
    >
      <LegalSection heading="1. Responsable du traitement">
        <LegalText>
          {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}, {LEGAL_ENTITY.country}.
          Pour toute question relative à vos données :{" "}
          {LEGAL_ENTITY.contactEmail}.
        </LegalText>
      </LegalSection>

      <LegalSection heading="2. Données collectées">
        <LegalText>
          Compte : adresse e-mail, nom d&apos;utilisateur, photo de profil si
          vous en ajoutez une, date de création du compte.
        </LegalText>
        <LegalText>
          Utilisation : ressources publiées, votes, collections, abonnements,
          signalements émis.
        </LegalText>
        <LegalText>
          Technique : identifiant de notification de votre appareil, adresse IP
          et horodatage lors des publications et des envois de fichiers,
          acceptation des conditions et déclaration d&apos;âge.
        </LegalText>
      </LegalSection>

      <LegalSection heading="3. Finalités et bases légales">
        <LegalText>
          Fournir le service et exécuter les conditions d&apos;utilisation
          (exécution du contrat) : compte, publications, collections.
        </LegalText>
        <LegalText>
          Modérer les contenus, traiter les signalements et les demandes de
          retrait, prévenir les abus (obligation légale et intérêt légitime).
        </LegalText>
        <LegalText>
          Envoyer les notifications auxquelles vous vous êtes abonné
          (consentement, révocable à tout moment dans les paramètres de
          l&apos;application et de votre téléphone).
        </LegalText>
        <LegalText>
          Améliorer l&apos;application au moyen de statistiques d&apos;usage
          (consentement). Ce traitement est facultatif : il est désactivé par
          défaut et se règle dans les paramètres.
        </LegalText>
      </LegalSection>

      <LegalSection heading="4. Destinataires">
        <LegalText>
          Vos données sont traitées par des prestataires agissant pour notre
          compte : Clerk (authentification), Convex (base de données et
          traitements), Cloudflare (stockage des fichiers), Expo (envoi des
          notifications), et un service d&apos;analyse automatisée des
          publications aux fins de modération. Aucune donnée n&apos;est vendue
          ni cédée à des fins publicitaires.
        </LegalText>
      </LegalSection>

      <LegalSection heading="5. Durées de conservation">
        <LegalText>
          Compte et publications : jusqu&apos;à la suppression du compte.
          Journaux techniques (adresse IP, horodatages) : douze mois.
          Enregistrements de retrait et de sanction : trois ans après la
          fermeture du compte, afin de pouvoir justifier des mesures prises.
        </LegalText>
      </LegalSection>

      <LegalSection heading="6. Suppression du compte">
        <LegalText>
          Vous pouvez supprimer votre compte depuis les paramètres de
          l&apos;application. La suppression efface votre profil, vos
          identifiants de notification, vos votes, vos collections et vos
          abonnements. Les ressources que vous avez publiées et qui ont été
          approuvées sont dissociées de votre compte et conservées de façon
          anonyme, afin de ne pas retirer aux autres utilisateurs un contenu
          qu&apos;ils ont sauvegardé.
        </LegalText>
      </LegalSection>

      <LegalSection heading="7. Vos droits">
        <LegalText>
          Vous disposez d&apos;un droit d&apos;accès, de rectification,
          d&apos;effacement, de limitation, d&apos;opposition et de portabilité
          de vos données. Ces droits s&apos;exercent en écrivant à{" "}
          {LEGAL_ENTITY.contactEmail}. Vous pouvez également introduire une
          réclamation auprès de l&apos;autorité de protection des données de
          votre pays de résidence.
        </LegalText>
      </LegalSection>

      <LegalSection heading="8. Demandes des autorités">
        <LegalText>
          Vos données ne sont transmises à une autorité que sur réquisition
          régulière, et dans les limites de ce que celle-ci exige. Aucune
          transmission spontanée n&apos;est effectuée.
        </LegalText>
      </LegalSection>

      <LegalSection heading="9. Sécurité">
        <LegalText>
          Les mots de passe sont gérés par notre prestataire
          d&apos;authentification et ne sont jamais accessibles à
          l&apos;éditeur. Les fichiers envoyés sont analysés par un antivirus
          avant toute mise à disposition. Les échanges avec l&apos;application
          sont chiffrés.
        </LegalText>
      </LegalSection>

      <LegalSection heading="10. Modification">
        <LegalText>
          Cette politique peut évoluer. Toute modification substantielle donne
          lieu à une information à l&apos;ouverture de l&apos;application.
        </LegalText>
      </LegalSection>
    </LegalDocument>
  );
}
