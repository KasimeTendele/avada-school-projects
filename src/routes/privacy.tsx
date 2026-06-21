import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Politique de Confidentialité — Avada School" },
      { name: "description", content: "Politique de confidentialité d'Avada School : collecte, utilisation et protection de vos données personnelles." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-16">
        <Link to="/" className="text-sm text-primary hover:underline">← Retour</Link>
        <article className="prose prose-slate dark:prose-invert mt-6 max-w-none">
          <h1>Politique de Confidentialité</h1>

          <h2>1. Préambule</h2>
          <p>Avadaschool accorde une importance particulière à la protection des données personnelles de ses utilisateurs. Cette politique de confidentialité complète les Conditions Générales d'Utilisation (CGU) et explique la manière dont les données sont collectées, utilisées, conservées et protégées.</p>

          <h2>2. Données collectées</h2>
          <p>Nous pouvons collecter les noms, prénoms, numéros de téléphone, adresses e-mail, informations scolaires, informations relatives aux paiements, historiques de transactions, données de connexion et toute autre information nécessaire au fonctionnement de la plateforme.</p>

          <h2>3. Finalités du traitement</h2>
          <p>Les données sont utilisées pour la gestion des comptes utilisateurs, le traitement des paiements scolaires, la génération des reçus, la communication avec les utilisateurs, l'assistance, l'amélioration des services, la prévention de la fraude et le respect des obligations légales.</p>

          <h2>4. Base légale</h2>
          <p>Les traitements sont réalisés sur la base du consentement de l'utilisateur, de l'exécution des services demandés, des obligations légales applicables et des intérêts légitimes liés à la sécurité et au bon fonctionnement de la plateforme.</p>

          <h2>5. Partage des données</h2>
          <p>Les données peuvent être partagées avec les établissements scolaires concernés, les partenaires de paiement, les prestataires techniques et les autorités compétentes lorsque la loi l'exige. Elles ne sont ni vendues ni cédées à des tiers à des fins commerciales sans consentement préalable.</p>

          <h2>6. Sécurité</h2>
          <p>Avadaschool met en œuvre des mesures techniques et organisationnelles appropriées afin de protéger les données contre la perte, l'altération, l'accès non autorisé ou toute utilisation abusive.</p>

          <h2>7. Conservation</h2>
          <p>Les données sont conservées pendant la durée nécessaire à la fourniture des services, au respect des obligations légales, à la gestion des litiges et à la prévention de la fraude.</p>

          <h2>8. Droits des utilisateurs</h2>
          <p>L'utilisateur peut demander l'accès à ses données, leur rectification, leur mise à jour, leur suppression lorsque cela est légalement possible, ainsi que la limitation de certains traitements.</p>

          <h2>9. Cookies et technologies similaires</h2>
          <p>Avadaschool peut utiliser des cookies et technologies similaires afin d'améliorer l'expérience utilisateur, assurer la sécurité et produire des statistiques d'utilisation.</p>

          <h2>10. Transferts de données</h2>
          <p>Lorsque cela est nécessaire pour l'exploitation des services, certaines données peuvent être traitées par des prestataires situés dans d'autres juridictions, sous réserve de garanties appropriées de protection.</p>

          <h2>11. Modifications</h2>
          <p>Cette politique peut être mise à jour à tout moment. Toute nouvelle version sera publiée sur la plateforme et prendra effet dès sa mise en ligne.</p>

          <h2>12. Contact</h2>
          <p>
            <strong>Avadaschool</strong><br />
            Email : Office.drc@avadapay.com<br />
            Téléphone : +243 812163851<br />
            Adresse : SILIKIN VILLAGE, Local A012, Bâtiment Phase3, Kinshasa, RDC<br />
            Site web : www.avadaschool.com
          </p>
        </article>
      </div>
    </div>
  );
}