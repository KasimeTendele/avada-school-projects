import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Conditions Générales d'Utilisation — Avada School" },
      { name: "description", content: "Conditions générales d'utilisation de la plateforme Avada School." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-16">
        <Link to="/" className="text-sm text-primary hover:underline">← Retour</Link>
        <article className="prose prose-slate dark:prose-invert mt-6 max-w-none">
          <h1>Conditions Générales d'Utilisation (CGU)</h1>
          <p className="text-muted-foreground">Plateforme numérique de gestion des paiements scolaires — Avadaschool</p>

          <h2>Avertissement important</h2>
          <p>Nous vous invitons à lire attentivement les présentes conditions générales d'utilisation (« CGU ») de la plateforme Avadaschool. Elles définissent les conditions d'accès, d'utilisation et de fonctionnement de la plateforme ainsi que les droits et obligations des utilisateurs. L'utilisation de la plateforme implique l'acceptation pleine et entière des présentes conditions.</p>

          <h2>Préambule</h2>
          <p>La plateforme Avadaschool est une solution numérique de gestion des paiements scolaires destinée aux établissements scolaires, parents d'élèves, universités, centres de formation et autres institutions éducatives.</p>
          <p>Avadaschool permet notamment :</p>
          <ul>
            <li>le paiement numérique des frais scolaires ;</li>
            <li>la gestion et le suivi des paiements ;</li>
            <li>la génération automatique des reçus ;</li>
            <li>la consultation des historiques de paiement ;</li>
            <li>la communication entre écoles et parents ;</li>
            <li>la production des statistiques financières ;</li>
            <li>la traçabilité des opérations financières ;</li>
            <li>l'amélioration de la transparence financière.</li>
          </ul>

          <h2>1. Définitions</h2>
          <ul>
            <li><strong>Avadaschool</strong> : la plateforme numérique de gestion des paiements scolaires et services associés.</li>
            <li><strong>Utilisateur</strong> : toute personne physique ou morale utilisant la plateforme (écoles, parents, élèves, promoteurs scolaires, agents administratifs, universités, centres de formation, partenaires).</li>
            <li><strong>Compte utilisateur</strong> : l'espace personnel créé par un utilisateur pour accéder aux services.</li>
            <li><strong>Données</strong> : toutes les informations enregistrées sur la plateforme (données scolaires, informations personnelles, historiques de paiements, reçus, transactions, informations administratives).</li>
            <li><strong>Services</strong> : l'ensemble des fonctionnalités offertes par Avadaschool.</li>
          </ul>

          <h2>2. Objet de la plateforme</h2>
          <p>Avadaschool a pour objet de digitaliser les paiements scolaires, simplifier les opérations financières des écoles, améliorer la transparence financière, faciliter les paiements des parents, réduire les pertes financières, moderniser la gestion scolaire et améliorer la communication entre écoles et parents.</p>

          <h2>3. Accès à la plateforme</h2>
          <p>L'accès est conditionné par la création d'un compte utilisateur, l'acceptation des présentes CGU et la fourniture d'informations exactes. L'utilisateur reconnaît disposer d'un accès internet, d'un appareil compatible et être responsable de ses équipements et connexions. La plateforme est accessible via navigateur web (www.avadaschool.com) et via application mobile (Android et iOS).</p>

          <h2>4. Création de compte</h2>
          <p>Chaque utilisateur doit fournir des informations exactes, les maintenir à jour et protéger ses identifiants. Le compte est personnel, non transférable et strictement confidentiel. Toute utilisation est réputée effectuée par son titulaire.</p>

          <h2>5. Utilisation des services</h2>
          <p>L'utilisateur s'engage à utiliser la plateforme conformément à la loi, à ne pas perturber le fonctionnement du système, à ne pas introduire de virus, à ne pas l'utiliser à des fins frauduleuses, et à ne pas usurper l'identité d'un tiers. Il est interdit de falsifier des paiements, manipuler les données financières, utiliser des comptes fictifs ou tenter un accès non autorisé.</p>

          <h2>6. Services de paiement</h2>
          <p>La plateforme permet le paiement des frais scolaires, le suivi des paiements, la génération automatique des reçus, la consultation des historiques et les notifications. Les paiements peuvent être effectués via mobile money, cartes bancaires, banques partenaires et solutions numériques intégrées.</p>

          <h2>7. Responsabilités des établissements scolaires</h2>
          <p>Les écoles s'engagent à fournir des informations exactes, définir correctement les frais scolaires, sécuriser les accès administratifs et respecter les règlementations applicables. Elles restent responsables des montants définis, de leur gestion administrative et des communications envoyées aux parents.</p>

          <h2>8. Responsabilités des parents et élèves</h2>
          <p>Les parents et élèves s'engagent à fournir des informations exactes, vérifier les montants avant paiement, conserver leurs références de paiement et signaler toute anomalie.</p>

          <h2>9. Disponibilité de la plateforme</h2>
          <p>Avadaschool s'efforce d'assurer une disponibilité continue. La plateforme peut être temporairement indisponible pour maintenance, mises à jour, incidents techniques, problèmes réseau ou cas de force majeure. Aucune indemnité ne pourra être réclamée en cas d'interruption temporaire.</p>

          <h2>10. Sécurité</h2>
          <p>Avadaschool met en œuvre des mesures techniques et organisationnelles pour protéger les données, sécuriser les transactions, prévenir les accès non autorisés et assurer la traçabilité. L'utilisateur reconnaît qu'internet n'est pas totalement sécurisé et qu'il lui appartient de protéger ses appareils et mots de passe.</p>

          <h2>11. Traçabilité des opérations</h2>
          <p>Toutes les opérations (connexions, paiements, modifications, validations, téléchargements, activités administratives) peuvent être enregistrées à des fins de sécurité, audit, lutte contre la fraude et conformité règlementaire.</p>

          <h2>12. Protection des données personnelles</h2>
          <p>Avadaschool protège les données personnelles conformément aux lois applicables. Les données collectées peuvent inclure noms, numéros de téléphone, informations scolaires, historiques de paiements et données financières nécessaires au service. Elles ne sont ni vendues ni cédées sans autorisation légale ou consentement. L'utilisateur peut demander l'accès, la rectification ou la suppression de ses données lorsque cela est légalement possible.</p>

          <h2>13. Propriété intellectuelle</h2>
          <p>La plateforme, son logo, son design, ses logiciels, ses interfaces, ses contenus et ses bases de données demeurent la propriété exclusive d'Avadaschool ou de ses partenaires. Toute reproduction, modification, extraction ou exploitation non autorisée est interdite.</p>

          <h2>14. Lutte contre la fraude</h2>
          <p>Avadaschool se réserve le droit de suspendre un compte suspect, bloquer une transaction et signaler des activités frauduleuses aux autorités. Toute tentative de fraude expose son auteur à des poursuites judiciaires, la suppression du compte et des sanctions administratives.</p>

          <h2>15. Suspension ou résiliation des comptes</h2>
          <p>Avadaschool peut suspendre ou supprimer un compte en cas de violation des CGU, d'activité frauduleuse, d'utilisation abusive, de fausses informations ou d'atteinte à la sécurité du système.</p>

          <h2>16. Responsabilité</h2>
          <p>Avadaschool ne pourra être tenu responsable des interruptions réseau, défaillances des opérateurs télécoms, erreurs de saisie des utilisateurs, retards liés aux partenaires financiers ni des cas de force majeure. Sa responsabilité est limitée aux obligations directement liées à la plateforme.</p>

          <h2>17. Modification des conditions générales</h2>
          <p>Avadaschool se réserve le droit de modifier les présentes CGU à tout moment. Les nouvelles versions entrent en vigueur dès leur publication. L'utilisation continue de la plateforme vaut acceptation des modifications.</p>

          <h2>18. Droit applicable et litiges</h2>
          <p>Les présentes CGU sont régies par les lois en vigueur en République Démocratique du Congo. En cas de litige, les parties privilégieront une résolution amiable ; à défaut, les juridictions compétentes de la RDC seront saisies.</p>

          <h2>19. Contact</h2>
          <p>
            <strong>Avadaschool</strong><br />
            Email : Office.drc@avadapay.com<br />
            Téléphone : +243 812163851<br />
            Adresse : SILIKIN VILLAGE, Local A012, Bâtiment Phase3, Kinshasa, RD Congo<br />
            Site web : www.avadaschool.com
          </p>

          <h2>20. Acceptation des conditions</h2>
          <p>En utilisant Avadaschool, l'utilisateur reconnaît avoir lu, compris et accepté sans réserve les présentes conditions générales d'utilisation.</p>

          <p className="text-sm text-muted-foreground">Version 1.0 — Mai 2026 — © Avadaschool, tous droits réservés.</p>
        </article>
      </div>
    </div>
  );
}