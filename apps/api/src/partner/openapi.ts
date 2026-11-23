/**
 * Description OpenAPI 3.1 de l'API partenaires (dossier, C24 et C27 : documentation
 * de l'API pour les tiers). Écrite à la main : elle décrit exactement le contrat
 * publié, et un test vérifie qu'elle couvre toutes les routes partenaires.
 */
const productCard = {
  type: "object",
  properties: {
    slug: { type: "string", example: "altivo-pulse-3" },
    name: { type: "string" },
    brand: { type: "string" },
    shortDescription: { type: "string" },
    fromPriceCents: { type: "integer", description: "Prix le plus bas, en centimes d'euro" },
    inStock: { type: "boolean" },
    imageUrl: { type: ["string", "null"] },
    imageAlt: { type: ["string", "null"] },
  },
} as const;

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export const OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "La Foulée : API partenaires",
    version: "1.0.0",
    description:
      "Catalogue et disponibilités des boutiques La Foulée, en lecture seule. Clé fournie par La Foulée sur demande. Limite : 60 requêtes par minute et par clé.",
  },
  servers: [{ url: "https://lafoulee.vercel.app/api/v1/partner" }],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: {
        type: "http",
        scheme: "bearer",
        description: "En-tête Authorization: Bearer lf_live_<préfixe>_<secret>",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { statusCode: { type: "integer" }, message: { type: "string" } },
      },
      ProductCard: productCard,
      ProductList: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/ProductCard" } },
          page: { type: "integer" },
          pageSize: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      Store: {
        type: "object",
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          address: { type: "string" },
          postalCode: { type: "string" },
          city: { type: "string" },
          openingHours: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/products": {
      get: {
        summary: "Liste paginée des produits publiés",
        description: "Droit requis : catalog:read.",
        parameters: [
          { name: "q", in: "query", schema: { type: "string", maxLength: 80 }, description: "Recherche plein texte" },
          { name: "categorie", in: "query", schema: { type: "string", pattern: "^[a-z0-9-]{1,60}$" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 1 } },
          {
            name: "tri",
            in: "query",
            schema: { type: "string", enum: ["pertinence", "nouveautes", "prix-croissant", "prix-decroissant"] },
          },
        ],
        responses: {
          "200": {
            description: "Page de produits",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProductList" } } },
          },
          "400": errorResponse("Paramètre invalide"),
          "401": errorResponse("Clé absente, invalide ou révoquée"),
          "403": errorResponse("Droit catalog:read manquant"),
          "429": errorResponse("Plus de 60 requêtes par minute"),
        },
      },
    },
    "/products/{slug}": {
      get: {
        summary: "Fiche produit avec ses variantes et le stock disponible par boutique",
        description: "Droit requis : catalog:read.",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", pattern: "^[a-z0-9-]{1,100}$" } },
        ],
        responses: {
          "200": { description: "Fiche produit" },
          "401": errorResponse("Clé absente, invalide ou révoquée"),
          "403": errorResponse("Droit catalog:read manquant"),
          "404": errorResponse("Produit introuvable"),
          "429": errorResponse("Plus de 60 requêtes par minute"),
        },
      },
    },
    "/stores": {
      get: {
        summary: "Liste des boutiques",
        description: "Droit requis : stock:read.",
        responses: {
          "200": {
            description: "Boutiques",
            content: {
              "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Store" } } },
            },
          },
          "401": errorResponse("Clé absente, invalide ou révoquée"),
          "403": errorResponse("Droit stock:read manquant"),
          "429": errorResponse("Plus de 60 requêtes par minute"),
        },
      },
    },
  },
} as const;
