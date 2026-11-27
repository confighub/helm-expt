// The Guide "Deploy one thing, and look before you do". It is a landing page
// for a visitor who wants one place to start. It follows one Catalog entry
// from its exact objects to a release on a local cluster.
//
// The page has three sources and no others. A command comes from the entry's
// listing, under nextSteps, or from one of two dated logs. The first walk
// (2026-10-08) ran the look, the save and the clean-up, with session names
// this page replaces by the listing's placeholders. The run of the deploy and
// promote steps (DEPLOY_WALK) ran the cluster, the release and the promotion
// with the page's own names. An output comes from one of the two logs. The
// builder checks each against its log, so the page cannot print a command or
// an output that no source holds.

import { DEPLOY_WALK } from "./entry-next-steps.mjs";

export const DEPLOY_ONE_ENTRY = "bitnami-nginx-24-0-2-http-clusterip";
export const DEPLOY_ONE_WALK_PATH = "docs/user/live-walk-entry-steps-2026-10-08.md";
export const DEPLOY_ONE_RELEASE_WALK_PATH = DEPLOY_WALK.path;

const WALK_DATE = "2026-10-08";
const WALK_ANCHOR = "entry-a-bitnami-nginx-24-0-2-http-clusterip";
const SPACE = "<your-space>";
const CLUSTER = "workshop";

// The names the walk used where this page prints a placeholder.
const WALK_SPACE = `cwwalk-1008-${DEPLOY_ONE_ENTRY}`;
const WALK_CLUSTER = "cwwalk-1008-kind";

// A command from the run of the deploy and promote steps, as it ran.
const RELEASE_COMMANDS = {
  clusterUp: `cub cluster up --name ${CLUSTER} --no-k8sbot`,
  applications: "kubectl -n argocd get applications.argoproj.io",
  workload: "kubectl -n nginx get deployment,service,pods,networkpolicy,pdb",
};

// Output that run's log holds, line for line.
const RELEASE_OUTPUT = {
  applications: [
    "NAME                 SYNC STATUS   HEALTH STATUS",
    "walk-nginx-dev       Synced        Healthy",
    "workshop-argo-apps   Synced        Healthy",
  ],
  workload: [
    "deployment.apps/nginx   1/1     1            1           19s",
    "service/nginx   ClusterIP   10.96.11.253   <none>        80/TCP,443/TCP   19s",
    "pod/nginx-d9699d4ff-pv4cx   1/1     Running   0          19s",
    "networkpolicy.networking.k8s.io/nginx   app.kubernetes.io/instance=nginx,app.kubernetes.io/name=nginx   19s",
    "poddisruptionbudget.policy/nginx   N/A             1                 1                     19s",
  ],
};

// Sentences of that run's log that the prose on this page restates.
const RELEASE_STATEMENTS = [
  "This is a dated record of one run. It is not a Guide and it is not a receipt for the entry.",
  "Both forms of step 3 made it as a hidden Unit named `installer`",
  "It did not clone the `installer` Unit.",
  "about 4.5 minutes after the publish",
  "User NodePort window: 30000-30009",
  "The change was one replica to two on the Deployment Unit in the base.",
  "added the `installer` Unit to the dev Space, hidden and with no Target",
  "Argo CD listed the 6 objects and no `InstallerRecord`",
  "The first cluster could not reach the server.",
  "A cluster that pulls from a hosted ConfigHub organization does not meet this.",
  "The cluster ran without k8sbot.",
  "It created the `dev` variant only.",
];

// A command from the first walk's log, written with the listing's names.
const WALK_COMMANDS = {
  removeApplication: `cub unit delete --space ${CLUSTER}-argo-apps ${SPACE}-dev`,
  publishApps: `cub release publish ${CLUSTER}-argo-apps`,
  deleteDev: `cub space delete --recursive ${SPACE}-dev`,
  deleteBase: `cub space delete --recursive ${SPACE}`,
  clusterDown: `cub cluster down --name ${CLUSTER} --delete-config`,
};

// Output the first walk's log holds, line for line.
const WALK_OUTPUT = {
  diff: ["Configuration diff: 1 added, 0 removed, 1 changed, 4 unchanged"],
};

// Sentences of the walk log that the prose on this page restates. Each one
// must still be in the log, joined onto one line.
const WALK_STATEMENTS = [
  "This is a dated record of one run. It is not a Guide and it is not a receipt for either entry.",
  "one disposable local kind cluster with Argo CD",
  "The retained file holds 5 objects. The installer rendered 6, because it adds a Namespace.",
  "The digest matches the listing.",
  "prints the Argo CD admin password to the terminal",
  "The cluster kept the workload. Fourteen minutes later the nginx Application and its two pods were still there",
  "The root Application's sync policy is `{\"automated\":{\"selfHeal\":true}, ...}` with no prune",
];

// The retained objects, by the Unit the walk's upload created for each one.
const OBJECT_KINDS = [
  ["Deployment", "deployment-nginx-nginx"],
  ["NetworkPolicy", "networkpolicy-nginx-nginx"],
  ["PodDisruptionBudget", "poddisruptionbudget-nginx-nginx"],
  ["Service", "service-nginx-nginx"],
  ["ServiceAccount", "serviceaccount-nginx-nginx"],
];

function asWalked(command) {
  return command
    .replaceAll(`${CLUSTER}-argo-apps`, `${WALK_CLUSTER}-argo-apps`)
    .replaceAll(`--name ${CLUSTER}`, `--name ${WALK_CLUSTER}`)
    .replaceAll(SPACE, WALK_SPACE);
}

/**
 * Return the content consumed by generate-public-site.mjs's splitGuideHtml.
 * listing is the entry's listing file, walkLog is the text of the first
 * walk's log and releaseLog the text of the deploy and promote run's log. The three helpers are the generator's own, so the page's command
 * blocks, tables and agent box match the rest of the site.
 */
export function deployOneThingGuide({ listing, walkLog, releaseLog, check, commandBlock, markdownLikeTable, agentNote }) {
  const id = listing.identity.id;
  check(id === DEPLOY_ONE_ENTRY, `the deploy-one-thing Guide reads ${DEPLOY_ONE_ENTRY}, and was given ${id}`);

  const section = walkLog.slice(walkLog.indexOf("## Entry A."), walkLog.indexOf("## Entry B."));
  check(section.length > 0, `${DEPLOY_ONE_WALK_PATH} has no Entry A section`);
  for (const [name, command] of Object.entries(WALK_COMMANDS)) {
    const walked = asWalked(command);
    check(walkLog.includes(`$ ${walked}`), `${DEPLOY_ONE_WALK_PATH} does not hold the command the Guide prints as ${name}: ${walked}`);
  }
  for (const line of Object.values(WALK_OUTPUT).flat()) {
    check(section.includes(`\n${line}\n`), `${DEPLOY_ONE_WALK_PATH} does not hold the output line the Guide quotes: ${line}`);
  }
  const flatLog = walkLog.replace(/\s+/g, " ");
  for (const statement of WALK_STATEMENTS) {
    check(flatLog.includes(statement), `${DEPLOY_ONE_WALK_PATH} no longer says what the Guide restates: ${statement}`);
  }
  for (const [name, command] of Object.entries(RELEASE_COMMANDS)) {
    check(releaseLog.includes(`$ ${command}`), `${DEPLOY_ONE_RELEASE_WALK_PATH} does not hold the command the Guide prints as ${name}: ${command}`);
  }
  for (const line of Object.values(RELEASE_OUTPUT).flat()) {
    check(releaseLog.includes(`\n${line}\n`), `${DEPLOY_ONE_RELEASE_WALK_PATH} does not hold the output line the Guide quotes: ${line}`);
  }
  const flatRelease = releaseLog.replace(/\s+/g, " ");
  for (const statement of RELEASE_STATEMENTS) {
    check(flatRelease.includes(statement), `${DEPLOY_ONE_RELEASE_WALK_PATH} no longer says what the Guide restates: ${statement}`);
  }
  for (const [, unit] of OBJECT_KINDS) {
    check(section.includes(`Successfully created unit ${unit} `), `${DEPLOY_ONE_WALK_PATH} does not show the upload creating ${unit}`);
  }

  // The listing's commands for one step, taken as they are. The count is
  // checked because the prose around each block describes those commands.
  const step = (stepId, count) => {
    const found = (listing.nextSteps ?? []).find((entry) => entry.id === stepId);
    check(found, `site/listings/${id}.json has no ${stepId} step`);
    check((found.commands ?? []).length === count, `site/listings/${id}.json gives ${(found.commands ?? []).length} ${stepId} commands, and the deploy-one-thing Guide describes ${count}`);
    return found;
  };
  const rows = (commands, comments) => commands.map((command, index) => ({
    comment: comments[index],
    cmd: command.command,
    ...(command.expect ? { out: command.expect } : {}),
  }));
  const getObjects = step("get-objects", 3);
  const compare = step("compare", 4);
  const upload = step("upload", 4);
  check(upload.liveWalk?.date && upload.liveWalk.date !== WALK_DATE, `site/listings/${id}.json links no run of cub package install from its upload step, and the Guide cites one`);
  const deploy = step("deploy", 2);
  const promote = step("promote", 3);
  for (const later of [deploy, promote]) {
    check(later.liveWalk?.path === DEPLOY_ONE_RELEASE_WALK_PATH, `site/listings/${id}.json links no run of the ${later.id} step, and the Guide cites ${DEPLOY_ONE_RELEASE_WALK_PATH}`);
  }

  check(listing.flattened.objectCount === OBJECT_KINDS.length, `site/listings/${id}.json counts ${listing.flattened.objectCount} objects, and the Guide names ${OBJECT_KINDS.length} kinds`);
  check((listing.lifecycle?.installTimeInputs ?? []).length === 0 && listing.lifecycle?.installTimeStatus === "not-yet-declared", `site/listings/${id}.json changed its install-time inputs, and the Guide says none is declared`);
  check((listing.routing?.requirements ?? []).length === 0 && (listing.routing?.routes ?? []).length === 0, `site/listings/${id}.json now records a requirement or a route, and the Guide says the entry page lists none`);
  const deployNotes = (deploy.notes ?? []).join(" ");
  for (const fact of ["a hidden Unit named `installer`", "one publish deploys the rendered objects", "opens ten ports", "about 4.5 minutes after the publish", "Healthy alone is not a pass"]) {
    check(deployNotes.includes(fact), `site/listings/${id}.json no longer notes what the Guide restates: ${fact}`);
  }
  check(/no recorded run for this entry/.test(deploy.summary), `site/listings/${id}.json changed its deploy summary, and the Guide says its commands have no recorded run`);
  const otherBase = (compare.siblings ?? []).filter((sibling) => sibling.relation === "other-base");
  check(otherBase.length === 1 && compare.commands[1].command.includes(otherBase[0].base), `site/listings/${id}.json changed its other bases, and the Guide compares with one`);

  const entryPage = `./charts/${listing.identity.page.split("/").pop()}`;
  const entrySteps = `${entryPage}#use-in-confighub`;
  const walkPage = `./d/${DEPLOY_ONE_WALK_PATH.replace(/\.md$/, ".html")}`;
  const releasePage = `./d/${DEPLOY_ONE_RELEASE_WALK_PATH.replace(/\.md$/, ".html")}`;
  const releaseDate = DEPLOY_WALK.date;
  const kinds = OBJECT_KINDS.map(([kind]) => kind);
  const kindList = `${kinds.slice(0, -1).map((kind) => `a ${kind}`).join(", ")} and a ${kinds.at(-1)}`;

  const opening = `    <p><strong>Who this is for.</strong> You want to deploy one app or package, and you want to see what it installs before anything runs.</p>
    <p><strong>What you get.</strong> You get the exact objects for one Catalog entry, the commands that saved and released it, and the end state that dated runs reached.</p>
    <p><strong>What each part needs.</strong> Looking needs <code>curl</code>, <code>shasum</code>, <code>kustomize</code> and <code>cub</code> with the installer plugin, and it needs no account and no cluster. Comparing two bases also needs the workshop plugin. Saving needs a ConfigHub account. Releasing and promoting need that account, Docker, kind and kubectl. One command then creates a local kind cluster and installs Argo CD on it.</p>
    <p><strong>Where you can stop.</strong> Stop after the look, and nothing is saved anywhere. Stop after the save, and the entry is in ConfigHub with nothing on a cluster.</p>
`;

  const body = `    <section aria-labelledby="choose">
      <h2 id="choose">1. Choose what to deploy</h2>
      <p>Start from what you have. Each row leads to a page that is on this site today.</p>
      ${markdownLikeTable([
        ["You start from", "Go to", "What you find there"],
        ["A Helm chart", `<a href="./charts/index.html">Configs</a>`, "Search for the chart and its version. The chart page lists the tested starting configurations and carries the five steps this page follows."],
        ["An AICR recipe", `<a href="./charts/index.html">Configs</a>, then <a href="./try-aicr.html">Try NVIDIA AICR for GPUs</a>`, "Configs lists the AICR entries too, and each entry page carries the same five steps. The second page pulls one retained configuration to read, with no GPU."],
        ["A stack", `<a href="./stack.html">Stacks</a>`, "Every shipped stack is listed with the check that looks for conflicts between its parts before anything renders."],
        ["An example app", `<a href="./apps.html">Apps</a>, then <a href="./put-an-app-on-a-platform.html">Put an app on a platform</a>`, "Apps lists every worked example app. The Guide checks one app against the platform it would run on."],
        ["Your own YAML or OCI", `<a href="./ask.html">Is my configuration right?</a>, then <a href="./oci.html">OCI shapes</a>`, "The first page checks your own chart and values, or YAML you have already rendered. The second names each OCI shape and the tool that reads it."],
      ], { rawSecondColumn: true })}
      <p>The steps on this page come from the five steps that chart pages and AICR entry pages carry. Stacks and apps have their own checks, so this page does not describe one path for every kind.</p>
      <p>Each entry page says what the Catalog has run for that entry. A step with a missing precondition gives no command there.</p>
      <p>This page follows one entry, <code>${id}</code>, because dated runs delivered it. It is the <code>${listing.identity.base}</code> base of ${listing.identity.name} ${listing.identity.version}, and <a href="${entrySteps}">its entry page</a> holds the full steps.</p>
      ${agentNote(`Read the same steps as data at <a href="./listings/${id}.json">listings/${id}.json</a>, in the <code>nextSteps</code> array. A command marked <code>needsAccount</code> there contacts ConfigHub, and one marked <code>writes</code> changes it. The dated logs are <code>${DEPLOY_ONE_WALK_PATH}</code> and <code>${DEPLOY_ONE_RELEASE_WALK_PATH}</code>, and neither is a receipt.`)}
    </section>
    <section aria-labelledby="look-first">
      <h2 id="look-first">2. Look first at what it installs and what it needs</h2>
      <p>These commands need no account and no cluster. <a href="./try.html#install-cub">Install cub and the installer plugin</a> first, and that section also checks for <code>kustomize</code>.</p>
      ${commandBlock(rows(getObjects.commands, [
        "fetch the exact objects the Catalog keeps for this entry",
        "check the bytes against the listing",
        "render the same base from the signed package, into a directory you can upload later",
      ]))}
      <p>The line under <code>shasum</code> is the value the listing expects. In the walk of ${WALK_DATE} the digest matched.</p>
      <p>The file holds ${listing.flattened.objectCount} objects. They are ${kindList}. In the walk the installer rendered 6 manifests, because it adds a Namespace.</p>
      <p>The <a href="${entryPage}">entry page</a> records nothing that must exist before you apply this base. It lists 0 target prerequisites and 0 hook or setup routes.</p>
      <p>The listing marks install-time inputs as not yet declared. The Catalog has therefore not ruled out a need on your own cluster.</p>
      <h3 id="compare">Compare it with the other base</h3>
      <p>This version has one other base in the Catalog, <code>${otherBase[0].base}</code>. The comparison uses <code>cub config diff</code>, which the workshop plugin adds, and the entry page gives the install line.</p>
      ${commandBlock([
        ...rows(compare.commands.slice(0, 1), ["fetch the other base of the same version"]),
        { comment: "list what differs between the two bases", cmd: compare.commands[1].command, out: WALK_OUTPUT.diff },
      ])}
      <p>The line under the second command is what the walk of ${WALK_DATE} printed. The entry page also compares this version with a later one.</p>
    </section>
    <section aria-labelledby="save-and-release">
      <h2 id="save-and-release">3. Save it and release it</h2>
      <p>Every command in this section needs a ConfigHub account, because each one reads or writes your organization.</p>
      <h3 id="save">Save it in ConfigHub, with an account</h3>
      <p>A <strong>Space</strong> groups related Units, such as one base or one environment. A <strong>Unit</strong> is one versioned piece of configuration, and the upload makes one for each rendered object.</p>
      ${commandBlock(rows(upload.commands, [
        "sign in to your ConfigHub organization",
        "save the signed package as a Space of Units in one command",
        "or, to name the Component yourself, upload the directory rendered above",
        "list the Units in the Space",
      ]))}
      <p>Run the second command or the third, not both. Replace each value in angle brackets with a name of your own. The entry id may already exist as a Space in your organization, and the package name as a Component.</p>
      <p>A <a href="./d/${upload.liveWalk.path.replace(/\.md$/, ".html")}">run on ${upload.liveWalk.date}</a> ran both forms, and each made the same 7 Units. Six are the rendered objects. The seventh is a hidden Unit named <code>installer</code> that records the package, so <code>cub unit list</code> shows six. <code>cub package show</code> reads the record back.</p>
      <p>You can stop here. The entry is saved in ConfigHub and nothing is on a cluster.</p>
      <h3 id="cluster">Create a local cluster, with Docker and kind</h3>
      <p>A <strong>Target</strong> defines where ConfigHub delivers the Units in a Space. This command creates a kind cluster, installs Argo CD on it, and creates the Target <code>${CLUSTER}/target</code>.</p>
      ${commandBlock([{ comment: "create the cluster, its Argo CD and its Target", cmd: RELEASE_COMMANDS.clusterUp }])}
      <p>The <a href="${releasePage}">run on ${releaseDate}</a> ran this command as printed. Without <code>--no-k8sbot</code> the command also installs k8sbot. In a <a href="https://github.com/confighub/helm-expt/blob/main/docs/user/live-walk-bundle-route-2026-11-02.md">run on 2026-11-02</a> that install failed.</p>
      <p>The command changes your machine and your organization. It creates two Spaces, a Target, a service account and a Trigger. It opens ten ports on the machine, 30000 to 30009 in that run, and installs Argo CD from an unpinned upstream manifest.</p>
      <p>Argo CD in the cluster pulls each Release from ConfigHub, so the cluster has to reach it. A cluster that pulls from a hosted ConfigHub organization does. In that run the server listened on the machine only, and the first cluster could not reach it until it was made again.</p>
      <p>It also prints the Argo CD admin password to the terminal.</p>
      <h3 id="release">Release it to that cluster</h3>
      <p>A <strong>Release</strong> is the published set of a Space's Units, and the cluster's Argo CD pulls it. The first command copies the base into a <code>dev</code> variant, which is a Space for one environment.</p>
      ${commandBlock(rows(deploy.commands, [
        "copy the base onto the Target as a dev variant",
        "publish the Release that the cluster's Argo CD pulls",
      ]))}
      <p>The variant copies the six rendered objects. It does not copy the hidden <code>installer</code> Unit, so one publish deploys the entry. The walk of ${WALK_DATE} also had to delete the record and publish again, and the run of ${releaseDate} found that no longer needed.</p>
      <h3 id="promote">Promote a change to dev</h3>
      <p>Promotion carries a change in the base to the <code>dev</code> variant. In the run of ${releaseDate} the change was one replica to two on the Deployment Unit in the base, and <a href="${releasePage}">its log</a> holds that command.</p>
      ${commandBlock(rows(promote.commands, [
        "preview what the dev variant would take from the base",
        "promote once you have read the preview",
        "publish the Release that carries the change",
      ]))}
      <p>The promotion changes the dev Space and publishes nothing. The change reaches the cluster only after the publish. The preview lists the whole package record as added, and the promotion adds the hidden <code>installer</code> Unit to the dev Space with no Target. The Release leaves it out.</p>
    </section>
    <section aria-labelledby="success">
      <h2 id="success">4. See what success looked like</h2>
      <p>This is what the run of ${releaseDate} printed after the publish in the release step. Its base Space was named <code>walk-nginx</code>.</p>
      ${commandBlock([
        { comment: "the Argo CD Application, with its sync and its health", cmd: RELEASE_COMMANDS.applications, out: RELEASE_OUTPUT.applications },
        { comment: "the workload on the cluster", cmd: RELEASE_COMMANDS.workload, out: RELEASE_OUTPUT.workload },
      ])}
      <p>Read the Sync column, because Healthy alone is not a pass. While the first cluster could not reach the server, the same command showed the root Application <code>Unknown</code> and <code>Healthy</code>, and every <code>cub</code> command had exited 0.</p>
      <p>ConfigHub shows nothing when Argo CD fails to read a Release, so this command is the check. On a cluster made without k8sbot, the Application was <code>Synced</code> and <code>Healthy</code> about 4.5 minutes after the publish.</p>
      <p>After the promotion and one more publish, the run ended with the Application <code>Synced</code> and <code>Healthy</code> and two replicas running. Argo CD listed the six objects and no package record.</p>
      <p>This is a dated record of one run, on one disposable local kind cluster with Argo CD. <a href="${releasePage}">The log</a> says it is not a receipt for the entry, so no Catalog state rests on it.</p>
    </section>
    <section aria-labelledby="not-covered">
      <h2 id="not-covered">5. Know what this run did not cover</h2>
      <ul>
        <li>The runs created the <code>dev</code> variant only. They created no staging variant and no production variant, so this page prints no command for either.</li>
        <li>The run of ${releaseDate} used a local ConfigHub server and did not run <code>cub auth login</code>. The walk of ${WALK_DATE} used an existing login.</li>
        <li>Neither tried Flux or plain kubectl delivery.</li>
        <li>The cluster ran without k8sbot, so the runs did not observe the result with k8sbot.</li>
        <li>The Catalog's own delivery record for this entry ran other commands. The release commands above have no recorded run for the entry, and they rest on the dated logs alone.</li>
      </ul>
      <p>To see whether your change survives a refresh from upstream, follow <a href="./journey-preserve-my-fixes.html">AI overwrites my fixes</a>. For every step and every caution, open <a href="${entrySteps}">the entry page</a>.</p>
    </section>
    <section aria-labelledby="go-back">
      <h2 id="go-back">6. Go back</h2>
      <p><a href="${walkPage}#${WALK_ANCHOR}">The walk of ${WALK_DATE}</a> removed this entry from ConfigHub with the first four commands, and it removed the cluster with the fifth. They delete what the earlier commands created, so run them only on names you chose.</p>
      ${commandBlock([
        { comment: "remove the Argo CD Application Unit from the cluster's apps Space", cmd: WALK_COMMANDS.removeApplication },
        { comment: "publish the apps Space without it", cmd: WALK_COMMANDS.publishApps },
        { comment: "delete the dev Space", cmd: WALK_COMMANDS.deleteDev },
        { comment: "delete the base Space", cmd: WALK_COMMANDS.deleteBase },
        { comment: "delete the kind cluster and the two Spaces that came with it", cmd: WALK_COMMANDS.clusterDown },
      ])}
      <p>The apps Space takes the cluster's name, so it is <code>${CLUSTER}-argo-apps</code> here.</p>
      <p>Deleting the ConfigHub side did not remove the workload. Fourteen minutes later the Application and its two pods were still on the cluster, because the root Application does not prune.</p>
      <p>The walk recorded no command that removes the workload and keeps the cluster. It also recorded no clean-up for the files the look wrote on the machine.</p>
    </section>
`;

  return {
    title: "Deploy one thing, and look before you do",
    lead: "Pick one Catalog entry and read the exact Kubernetes objects it installs. Then save it in ConfigHub, release it to a cluster, and compare your result with one dated run.",
    opening,
    body,
  };
}
