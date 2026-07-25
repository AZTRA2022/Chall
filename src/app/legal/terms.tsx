import {
  LegalDocument,
  LegalSection,
  LegalText,
} from "@/components/legal-document";
import { LEGAL_ENTITY, MINIMUM_AGE, TERMS_VERSION } from "@/constants/legal";

export default function TermsScreen() {
  return (
    <LegalDocument
      title="CONDITIONS D'UTILISATION"
      headerTitle="Conditions"
      version={TERMS_VERSION}
    >
      <LegalSection heading="1. Objet">
        <LegalText>
          Chall est une application de partage de ressources gratuites. Les
          utilisateurs y publient des liens et, dans les limites décrites à
          l&apos;article 5, des fichiers dont ils sont les auteurs. Les présentes
          conditions régissent l&apos;utilisation de l&apos;application. Créer un
          compte vaut acceptation de ces conditions.
        </LegalText>
      </LegalSection>

      <LegalSection heading="2. Éditeur">
        <LegalText>
          L&apos;application est éditée par {LEGAL_ENTITY.name},{" "}
          {LEGAL_ENTITY.address}, {LEGAL_ENTITY.country}. Contact :{" "}
          {LEGAL_ENTITY.contactEmail}.
        </LegalText>
      </LegalSection>

      <LegalSection heading="3. Âge minimum">
        <LegalText>
          L&apos;application est réservée aux personnes âgées d&apos;au moins{" "}
          {MINIMUM_AGE} ans. En créant un compte, vous déclarez avoir cet âge.
          Tout compte dont il apparaît qu&apos;il a été créé par une personne
          plus jeune est supprimé, ainsi que les données associées.
        </LegalText>
      </LegalSection>

      <LegalSection heading="4. Compte">
        <LegalText>
          Vous êtes responsable de la confidentialité de vos identifiants et des
          actions effectuées depuis votre compte. Vous pouvez le supprimer à
          tout moment depuis les paramètres de l&apos;application.
        </LegalText>
      </LegalSection>

      <LegalSection heading="5. Contenu publié">
        <LegalText>
          Vous êtes seul responsable de ce que vous publiez. Il est interdit de
          publier : du contenu protégé par le droit d&apos;auteur que vous
          n&apos;êtes pas autorisé à diffuser, des logiciels piratés, des
          contournements de protection, des logiciels malveillants, du contenu
          pornographique, haineux, violent, ou portant atteinte à la vie privée
          d&apos;autrui.
        </LegalText>
        <LegalText>
          Le téléversement de fichiers est réservé aux fichiers dont vous êtes
          l&apos;auteur ou que vous avez le droit de distribuer. Chaque envoi
          suppose une déclaration en ce sens de votre part. Les fichiers
          exécutables ne sont pas acceptés ; pour ces ressources, utilisez un
          lien vers la source officielle.
        </LegalText>
        <LegalText>
          Tolérance zéro : aucun contenu répréhensible ni comportement abusif
          n&apos;est admis. Les publications qui enfreignent ces règles sont
          retirées et leurs auteurs peuvent être exclus sans préavis.
        </LegalText>
      </LegalSection>

      <LegalSection heading="6. Modération">
        <LegalText>
          Les publications sont examinées avant leur mise en ligne, par un
          filtrage automatique puis, si nécessaire, par un modérateur humain.
          Vous pouvez signaler toute publication depuis sa fiche, et bloquer un
          autre utilisateur depuis les paramètres.
        </LegalText>
      </LegalSection>

      <LegalSection heading="7. Retrait sur notification">
        <LegalText>
          Tout titulaire de droits peut demander le retrait d&apos;un contenu en
          écrivant à {LEGAL_ENTITY.abuseEmail}. La demande doit identifier le
          contenu visé, justifier des droits invoqués et indiquer des
          coordonnées de contact. Les contenus signalés de façon fondée sont
          retirés sans délai.
        </LegalText>
        <LegalText>
          Les comptes ayant fait l&apos;objet de trois retraits fondés sont
          fermés définitivement.
        </LegalText>
      </LegalSection>

      <LegalSection heading="8. Responsabilité">
        <LegalText>
          L&apos;éditeur agit comme hébergeur des contenus publiés par les
          utilisateurs. Il n&apos;en assure ni la sélection ni la vérification
          préalable au-delà de la modération décrite à l&apos;article 6, et ne
          peut être tenu responsable des contenus qu&apos;il n&apos;a pas
          effectivement connus. Les liens externes pointent vers des sites
          tiers dont l&apos;éditeur ne contrôle ni le contenu ni la
          disponibilité.
        </LegalText>
      </LegalSection>

      <LegalSection heading="9. Suspension et suppression">
        <LegalText>
          L&apos;éditeur peut suspendre ou supprimer un compte en cas de
          manquement aux présentes conditions. Vous pouvez supprimer le vôtre à
          tout moment, ce qui efface vos données dans les conditions décrites
          par la politique de confidentialité.
        </LegalText>
      </LegalSection>

      <LegalSection heading="10. Modification des conditions">
        <LegalText>
          Les présentes conditions peuvent être modifiées. Toute modification
          substantielle donne lieu à une nouvelle demande d&apos;acceptation à
          l&apos;ouverture de l&apos;application.
        </LegalText>
      </LegalSection>

      <LegalSection heading="11. Droit applicable">
        <LegalText>
          Les présentes conditions sont régies par le droit en vigueur à
          l&apos;adresse d&apos;établissement de l&apos;éditeur indiquée à
          l&apos;article 2. Pour toute question : {LEGAL_ENTITY.contactEmail}.
        </LegalText>
      </LegalSection>
    </LegalDocument>
  );
}
