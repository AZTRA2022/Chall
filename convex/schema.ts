import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const categoryValidator = v.union(
  v.literal("formation"),
  v.literal("logiciel"),
  v.literal("app"),
  v.literal("mod"),
  v.literal("video"),
  v.literal("lien"),
  v.literal("photo"),
  v.literal("autre"),
);

export const resourceStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("dead"),
);

export const scanStatusValidator = v.union(
  v.literal("pending"),
  v.literal("clean"),
  v.literal("infected"),
  v.literal("error"),
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    /** Nom affiché, modifiable. `username` reste l'identifiant unique. */
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    /** Consentement facultatif aux statistiques d'usage. Faux par défaut. */
    dataCollectionConsent: v.boolean(),

    // Acceptation contractuelle. Optionnels : les comptes créés avant la mise
    // en place du recueil n'en ont pas, et l'app leur redemande leur accord.
    termsAcceptedAt: v.optional(v.number()),
    termsVersion: v.optional(v.string()),
    privacyVersion: v.optional(v.string()),
    ageConfirmedAt: v.optional(v.number()),

    /**
     * Rôle de modération. Absent vaut `user`.
     *
     * Attribué côté serveur uniquement. L'app s'en sert pour masquer l'écran de
     * file d'attente, mais masquer n'est pas protéger : chaque query et mutation
     * de modération revérifie le rôle.
     */
    role: v.optional(
      v.union(v.literal("user"), v.literal("mod"), v.literal("admin")),
    ),

    /** Retraits fondés. À 3, le compte est fermé (safe harbor). */
    strikes: v.optional(v.number()),

    /** @deprecated remplacé par la table `pushTokens`. Gardé pour les docs existants. */
    pushTokens: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]),

  resources: defineTable({
    title: v.string(),
    description: v.optional(v.string()),

    /**
     * `link` pointe vers l'extérieur, les trois autres sont hébergés.
     * Un `fileId` est présent si et seulement si `kind !== "link"`.
     */
    kind: v.union(
      v.literal("link"),
      v.literal("image"),
      v.literal("video"),
      v.literal("file"),
    ),
    url: v.optional(v.string()),
    /**
     * URL normalisée, unique. Sert de clé d'anti-doublon : indexer l'URL exacte
     * plutôt qu'un hash évite toute collision et reste lisible en base.
     */
    canonicalUrl: v.optional(v.string()),
    sourceDomain: v.optional(v.string()),
    fileId: v.optional(v.id("files")),

    category: categoryValidator,
    tags: v.array(v.string()),

    /**
     * Couverture, indépendante du contenu : une affiche pour une formation, une
     * vignette pour un lien, une image d'arrêt pour une vidéo.
     *
     * Deux sources possibles. `posterFileId` désigne une image envoyée par
     * l'auteur ; `thumbUrl` porte une image distante, récupérée à l'unfurl lors
     * des imports. La première l'emporte quand les deux existent.
     */
    posterFileId: v.optional(v.id("files")),
    thumbUrl: v.optional(v.string()),

    origin: v.union(v.literal("user"), v.literal("import")),
    submittedBy: v.optional(v.id("users")),

    status: resourceStatusValidator,
    /** Motifs relevés automatiquement : domaine bloqué, mot-clé suspect. */
    autoFlags: v.array(v.string()),
    moderationReason: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),

    voteCount: v.number(),
    saveCount: v.number(),
    /** `votes / (heures + 2)^1.5`, recalculé au vote et par cron horaire. */
    hotScore: v.number(),

    createdAt: v.number(),
    approvedAt: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
  })
    .index("by_canonical_url", ["canonicalUrl"])
    .index("by_status_hot", ["status", "hotScore"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_status_votes", ["status", "voteCount"])
    .index("by_author", ["submittedBy"])
    .index("by_status_category", ["status", "category"]),

  files: defineTable({
    /**
     * Fournisseur de stockage. Figé à la création de l'objet : un fichier déjà
     * envoyé garde son fournisseur même si les nouveaux envois changent de
     * destination. Exactement un des deux champs suivants est renseigné.
     */
    storageProvider: v.union(v.literal("convex"), v.literal("r2")),
    /** Identifiant Convex, quand `storageProvider` vaut `convex`. */
    storageId: v.optional(v.id("_storage")),
    /** Clé d'objet R2, quand `storageProvider` vaut `r2`. */
    storageKey: v.optional(v.string()),
    filename: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    /** Calculé côté serveur après l'envoi : un hash fourni par le client ne prouve rien. */
    sha256: v.optional(v.string()),
    scanStatus: scanStatusValidator,
    scanEngine: v.optional(v.string()),
    scanAt: v.optional(v.number()),
    /** Horodatage de la déclaration d'auteur (article 5 des conditions). */
    authorDeclaredAt: v.number(),
    /** Vidé à la suppression du compte : le fichier survit, son auteur non. */
    uploadedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_user", ["uploadedBy"])
    .index("by_sha256", ["sha256"])
    .index("by_scan_status", ["scanStatus"]),

  votes: defineTable({
    resourceId: v.id("resources"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_resource_user", ["resourceId", "userId"])
    .index("by_user", ["userId"])
    .index("by_resource", ["resourceId"]),

  /**
   * Signalements. Trois signalements distincts remettent la ressource en file
   * de modération : la réactivité ne doit pas dépendre de la présence d'un
   * modérateur.
   */
  reports: defineTable({
    resourceId: v.id("resources"),
    userId: v.id("users"),
    reason: v.union(
      v.literal("pirate"),
      v.literal("mort"),
      v.literal("hors-sujet"),
      v.literal("trompeur"),
      v.literal("dangereux"),
    ),
    note: v.optional(v.string()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_resource", ["resourceId"])
    .index("by_resource_user", ["resourceId", "userId"])
    .index("by_resolved", ["resolvedAt"]),

  /** Blocage entre comptes (exigence Apple 1.2). */
  blocks: defineTable({
    userId: v.id("users"),
    blockedUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_pair", ["userId", "blockedUserId"]),

  /** Sauvegardes. Une collection par défaut suffit au V1. */
  saves: defineTable({
    userId: v.id("users"),
    resourceId: v.id("resources"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_resource", ["userId", "resourceId"]),

  /** Abonnements à une catégorie ou à un tag. */
  subscriptions: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("category"), v.literal("tag")),
    value: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_target", ["userId", "kind", "value"])
    .index("by_target", ["kind", "value"]),

  /** Journal des retraits, preuve de diligence en cas de litige. */
  takedowns: defineTable({
    resourceId: v.id("resources"),
    sha256: v.optional(v.string()),
    claimant: v.string(),
    note: v.string(),
    receivedAt: v.number(),
    actedAt: v.number(),
    actedBy: v.id("users"),
  }).index("by_resource", ["resourceId"]),

  /** Domaines refusés à la source, avant toute analyse. */
  blockedDomains: defineTable({
    domain: v.string(),
    reason: v.string(),
  }).index("by_domain", ["domain"]),

  /** Empreintes des fichiers retirés : un retrait doit être durable. */
  blockedHashes: defineTable({
    sha256: v.string(),
    reason: v.string(),
    blockedAt: v.number(),
  }).index("by_sha256", ["sha256"]),

  // Un doc par device. Indexé par token pour qu'un device qui change de compte
  // soit réattribué au lieu d'être présent chez deux users à la fois.
  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),
});
