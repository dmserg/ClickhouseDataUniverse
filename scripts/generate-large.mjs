import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

const engines = [
  ["ReplicatedMergeTree", "MergeTree"],
  ["MergeTree", "MergeTree"],
  ["SummingMergeTree", "MergeTree"],
  ["ReplacingMergeTree", "MergeTree"],
  ["TinyLog", "Log"],
  ["Memory", "Memory"],
  ["Kafka", "Integration"],
  ["S3", "Integration"]
];
const galaxyNames = [
  "tatooine",
  "naboo",
  "coruscant",
  "alderaan",
  "hoth",
  "endor",
  "dagobah",
  "mustafar",
  "kashyyyk",
  "kamino",
  "geonosis",
  "bespin",
  "jakku",
  "scarif",
  "jedha",
  "lothal",
  "mandalore",
  "dathomir",
  "exegol",
  "crait",
  "corellia",
  "kessel",
  "mon_cala",
  "ryloth",
  "felucia",
  "utapau",
  "mygeeto",
  "christophsis",
  "malachor",
  "yavin_4",
  "ajan_kloss",
  "ilum",
  "niamos",
  "ferrix",
  "narkina_5",
  "nevarro",
  "sorgan",
  "trask",
  "teth",
  "onderon",
  "rishi",
  "saleucami",
  "polis_massa",
  "hosnian_prime",
  "takodana",
  "d_qar",
  "ahch_to",
  "savareen",
  "vandor",
  "moraband"
];
const entityNames = [
  "luke_skywalker",
  "leia_organa",
  "han_solo",
  "chewbacca",
  "obi_wan_kenobi",
  "anakin_skywalker",
  "ahsoka_tano",
  "padme_amidala",
  "yoda",
  "mace_windu",
  "qui_gon_jinn",
  "rey_skywalker",
  "finn",
  "poe_dameron",
  "lando_calrissian",
  "cassian_andor",
  "jyn_erso",
  "din_djarin",
  "grogu",
  "bo_katan",
  "hera_syndulla",
  "ezra_bridger",
  "sabine_wren",
  "kanan_jarrus",
  "captain_rex",
  "commander_cody",
  "boba_fett",
  "jango_fett",
  "darth_vader",
  "darth_maul",
  "emperor_palpatine",
  "count_dooku",
  "general_grievous",
  "kylo_ren",
  "grand_moff_tarkin",
  "grand_admiral_thrawn",
  "asajj_ventress",
  "moff_gideon",
  "r2_d2",
  "c_3po",
  "bb_8",
  "k_2so",
  "chopper",
  "ig_11",
  "millennium_falcon",
  "razor_crest",
  "ghost",
  "x_wing",
  "tie_fighter",
  "star_destroyer",
  "death_star",
  "home_one",
  "slave_one",
  "tantive_iv",
  "executor",
  "fondor_haulcraft",
  "jedi_temple",
  "mos_eisley",
  "cloud_city",
  "echo_base",
  "massassi_temple",
  "theed_palace",
  "imperial_palace",
  "clone_facility",
  "niima_outpost",
  "black_spire",
  "a_new_hope",
  "the_empire_strikes_back",
  "return_of_the_jedi",
  "the_phantom_menace",
  "attack_of_the_clones",
  "revenge_of_the_sith",
  "the_force_awakens",
  "the_last_jedi",
  "the_rise_of_skywalker",
  "rogue_one",
  "solo",
  "the_clone_wars",
  "rebels",
  "the_mandalorian",
  "andor",
  "the_bad_batch",
  "tales_of_the_jedi",
  "jedi_order",
  "galactic_senate",
  "rebel_alliance",
  "galactic_empire",
  "first_order",
  "resistance",
  "trade_federation",
  "separatist_alliance",
  "night_sisters",
  "mandalorian_clans",
  "inquisitorius",
  "kyber_crystal",
  "holocron",
  "lightsaber",
  "dark_saber",
  "beskar"
];
const dataSubjects = [
  "missions",
  "telemetry",
  "encounters",
  "hyperspace_routes",
  "archive",
  "events",
  "intelligence",
  "supply_manifest",
  "holonet_feed",
  "battle_records"
];
const owners = [
  "Jedi Archives",
  "Rebel Intelligence",
  "Imperial Logistics",
  "Senate Analytics",
  "Droid Operations"
];
const tags = ["rebel", "imperial", "jedi", "sith", "outer-rim", "clone-wars", "force", "hyperspace"];
const edgeTypes = [
  "etl_transfer",
  "view_dependency",
  "manual_dependency",
  "distributed_reference",
  "unknown"
];

function createDataset({ seed, schemaCount, nodeCount, edgeCount, pathCount, name }) {
  const random = randomSource(seed);
  const titleCase = (value) =>
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const nodeNameAt = (index) => {
    const entity = entityNames[index % entityNames.length];
    const subject = dataSubjects[Math.floor(index / entityNames.length) % dataSubjects.length];
    const era = Math.floor(index / (entityNames.length * dataSubjects.length));
    return `${entity}_${subject}${era > 0 ? `_era_${era + 1}` : ""}`;
  };
  const schemas = Array.from({ length: schemaCount }, (_, index) => ({
    id: `schema.${galaxyNames[index]}`,
    name: galaxyNames[index],
    displayName: titleCase(galaxyNames[index]),
    owner: owners[index % owners.length],
    tags: [tags[index % tags.length]]
  }));
  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const schemaIndex = index % schemaCount;
    const schema = schemas[schemaIndex];
    const nodeName = nodeNameAt(index);
    let kind = "table";
    if (index % 19 === 0) kind = "view";
    if (index % 31 === 0) kind = "materialized_view";
    if (index % 43 === 0) kind = "distributed_table";
    if (index % 71 === 0) kind = "external_table";
    if (index % 113 === 0) kind = "special_table";
    const [engine, engineFamily] = engines[Math.floor(random() * engines.length)];
    const sizeBytes =
      kind === "view" || kind === "distributed_table"
        ? undefined
        : Math.floor(Math.pow(10, 6 + Math.pow(random(), 1.8) * 9));
    const node = {
      id: `node.${schema.name}.${nodeName}`,
      schemaId: schema.id,
      name: nodeName,
      qualifiedName: `${schema.name}.${nodeName}`,
      kind,
      description: `${titleCase(nodeName)} ${kind.replaceAll("_", " ")} in the ${schema.displayName} galaxy`,
      owner: owners[index % owners.length],
      tags: [tags[index % tags.length], tags[(index * 3 + 1) % tags.length]],
      metrics: { freshnessMinutes: index % 240 }
    };
    if (kind !== "view") {
      node.table = {
        engine: kind === "distributed_table" ? "Distributed" : engine,
        engineFamily: kind === "distributed_table" ? "Distributed" : engineFamily,
        hasOwnData: kind !== "distributed_table",
        size: sizeBytes
          ? { bytes: sizeBytes, kind: "compressed", scope: "unique", isApproximate: index % 7 === 0 }
          : { kind: "unknown", scope: "unknown", isApproximate: false },
        rows: sizeBytes ? Math.floor(sizeBytes / (20 + random() * 180)) : undefined
      };
    }
    if (kind === "view") node.view = { viewType: index % 4 === 0 ? "live" : "normal" };
    if (kind === "materialized_view") node.materializedView = { mode: index % 2 ? "incremental" : "refreshable" };
    if (kind === "distributed_table") {
      node.distributedTable = {
        clusterName: "galactic_holonet",
        remoteSchema: schema.name,
        remoteTable: nodeNameAt((index + schemaCount) % nodeCount)
      };
    }
    return node;
  });

  const edges = [];
  const edgeKeys = new Set();
  const knownPaths = [];
  const addEdge = (sourceIndex, targetIndex, type, label) => {
    if (sourceIndex === targetIndex || sourceIndex >= nodeCount || targetIndex >= nodeCount) return false;
    const key = `${sourceIndex}:${targetIndex}:${type}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    edges.push({
      id: `edge.${String(edges.length).padStart(5, "0")}`,
      sourceNodeId: nodes[sourceIndex].id,
      targetNodeId: nodes[targetIndex].id,
      type,
      ...(label ? { label } : {}),
      tags: [type === "etl_transfer" ? "hourly" : "lineage"]
    });
    return true;
  };

  const pathLength = Math.min(name === "small" ? 6 : 12, Math.floor(nodeCount / Math.max(1, pathCount)));
  const reservedPathNodes = pathLength * pathCount;
  for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
    const start = pathIndex * pathLength;
    const ids = [];
    for (let step = 0; step < pathLength; step += 1) {
      const nodeIndex = start + step;
      ids.push(nodes[nodeIndex].id);
      if (step > 0) addEdge(nodeIndex - 1, nodeIndex, "etl_transfer", `hyperspace-route-${pathIndex + 1}`);
    }
    knownPaths.push(ids);
  }

  // Reserve a small tail as explicit disconnected/isolated components.
  const connectedLimit = Math.max(2, nodeCount - Math.max(3, Math.floor(nodeCount * 0.008)));
  let attempts = 0;
  while (edges.length < edgeCount && attempts < edgeCount * 30) {
    attempts += 1;
    const randomPool = connectedLimit - reservedPathNodes;
    const source = reservedPathNodes + Math.floor(random() * randomPool);
    const nearby = random() < 0.72;
    const target = nearby
      ? reservedPathNodes +
        ((source - reservedPathNodes + 1 + Math.floor(random() * Math.min(80, randomPool - 1))) %
          randomPool)
      : reservedPathNodes + Math.floor(random() * randomPool);
    const targetNode = nodes[target];
    let type = edgeTypes[Math.floor(random() * edgeTypes.length)];
    if (targetNode.kind === "view") type = "view_dependency";
    if (targetNode.kind === "materialized_view") type = "materialized_view_input";
    if (targetNode.kind === "distributed_table") type = "distributed_reference";
    addEdge(source, target, type);
  }

  for (const node of nodes) {
    if (node.kind !== "materialized_view") continue;
    const targetIndex = (nodes.indexOf(node) + schemaCount) % connectedLimit;
    node.materializedView.targetNodeId = nodes[targetIndex].id;
    addEdge(nodes.indexOf(node), targetIndex, "materialized_view_target");
  }

  return {
    document: {
      formatVersion: "1.0",
      universe: {
        id: `clickhouse-universe-${name}`,
        name: `${name === "small" ? "Skywalker Saga" : "Galactic Archives"} ClickHouse Universe`,
        description: "Deterministic Star Wars-inspired ClickHouse lineage graph",
        generatedAt: "2026-07-26T00:00:00Z",
        layoutSeed: seed
      },
      schemas,
      nodes,
      edges,
      layout: null
    },
    knownPaths
  };
}

const output = resolve(process.cwd(), "public", "mock");
await mkdir(output, { recursive: true });
const small = createDataset({
  seed: 42042,
  schemaCount: 6,
  nodeCount: 72,
  edgeCount: 210,
  pathCount: 3,
  name: "small"
});
const large = createDataset({
  seed: 42042,
  schemaCount: 50,
  nodeCount: 3000,
  edgeCount: 32000,
  pathCount: 20,
  name: "large"
});
await Promise.all([
  writeFile(resolve(output, "universe-small.json"), JSON.stringify(small.document, null, 2)),
  writeFile(resolve(output, "universe-large.json"), JSON.stringify(large.document)),
  writeFile(resolve(output, "known-paths-small.json"), JSON.stringify(small.knownPaths, null, 2)),
  writeFile(resolve(output, "known-paths-large.json"), JSON.stringify(large.knownPaths, null, 2))
]);
console.log(`Generated ${small.document.nodes.length}/${small.document.edges.length} small nodes/edges`);
console.log(`Generated ${large.document.nodes.length}/${large.document.edges.length} large nodes/edges`);
