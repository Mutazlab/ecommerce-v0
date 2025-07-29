import { elasticsearch } from "@/lib/database/connection"

// Elasticsearch index mappings
const productMapping = {
  mappings: {
    properties: {
      id: { type: "keyword" },
      sku: { type: "keyword" },
      slug: { type: "keyword" },
      name: {
        type: "object",
        properties: {
          en: {
            type: "text",
            analyzer: "english",
            fields: {
              keyword: { type: "keyword" },
              suggest: { type: "completion" },
            },
          },
          ar: {
            type: "text",
            analyzer: "arabic",
            fields: {
              keyword: { type: "keyword" },
              suggest: { type: "completion" },
            },
          },
        },
      },
      description: {
        type: "object",
        properties: {
          en: { type: "text", analyzer: "english" },
          ar: { type: "text", analyzer: "arabic" },
        },
      },
      category: {
        type: "object",
        properties: {
          id: { type: "keyword" },
          name: {
            type: "object",
            properties: {
              en: { type: "text", analyzer: "english" },
              ar: { type: "text", analyzer: "arabic" },
            },
          },
        },
      },
      price: { type: "double" },
      compare_price: { type: "double" },
      tags: { type: "keyword" },
      is_active: { type: "boolean" },
      is_featured: { type: "boolean" },
      inventory_quantity: { type: "integer" },
      created_at: { type: "date" },
      updated_at: { type: "date" },
    },
  },
  settings: {
    analysis: {
      analyzer: {
        arabic: {
          tokenizer: "standard",
          filter: ["lowercase", "arabic_normalization", "arabic_stem"],
        },
      },
    },
  },
}

export async function setupElasticsearch() {
  try {
    // Create products index
    const indexExists = await elasticsearch.indices.exists({ index: "products" })

    if (!indexExists) {
      await elasticsearch.indices.create({
        index: "products",
        body: productMapping,
      })
      console.log("Elasticsearch products index created")
    }

    // Create synonym sets for better search
    await elasticsearch.indices.putSettings({
      index: "products",
      body: {
        settings: {
          analysis: {
            filter: {
              synonym_filter: {
                type: "synonym",
                synonyms: [
                  "phone,mobile,smartphone,cell phone",
                  "laptop,computer,notebook,pc",
                  "shirt,top,blouse,tee",
                  "shoes,footwear,sneakers,boots",
                  "bag,purse,handbag,backpack",
                  "watch,timepiece,clock",
                ],
              },
            },
            analyzer: {
              synonym_analyzer: {
                tokenizer: "standard",
                filter: ["lowercase", "synonym_filter"],
              },
            },
          },
        },
      },
    })
  } catch (error) {
    console.error("Elasticsearch setup error:", error)
  }
}

// Index product in Elasticsearch
export async function indexProduct(product: any) {
  try {
    await elasticsearch.index({
      index: "products",
      id: product.id,
      body: {
        id: product.id,
        sku: product.sku,
        slug: product.slug,
        name: product.translations,
        description: product.translations,
        category: product.category,
        price: product.price,
        compare_price: product.compare_price,
        tags: product.tags,
        is_active: product.is_active,
        is_featured: product.is_featured,
        inventory_quantity: product.inventory_quantity,
        created_at: product.created_at,
        updated_at: product.updated_at,
      },
    })
  } catch (error) {
    console.error("Product indexing error:", error)
  }
}

// Search products with fuzzy matching and synonyms
export async function searchProducts(query: string, locale = "en", filters: any = {}) {
  try {
    const searchBody: any = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: [`name.${locale}^3`, `description.${locale}^2`, `category.name.${locale}`, "tags^2"],
                fuzziness: "AUTO",
                operator: "or",
              },
            },
          ],
          filter: [],
        },
      },
      highlight: {
        fields: {
          [`name.${locale}`]: {},
          [`description.${locale}`]: {},
        },
      },
      suggest: {
        product_suggest: {
          prefix: query,
          completion: {
            field: `name.${locale}.suggest`,
            size: 5,
          },
        },
      },
    }

    // Apply filters
    if (filters.category) {
      searchBody.query.bool.filter.push({
        term: { "category.id": filters.category },
      })
    }

    if (filters.price_min || filters.price_max) {
      const priceRange: any = {}
      if (filters.price_min) priceRange.gte = filters.price_min
      if (filters.price_max) priceRange.lte = filters.price_max

      searchBody.query.bool.filter.push({
        range: { price: priceRange },
      })
    }

    if (filters.in_stock) {
      searchBody.query.bool.filter.push({
        range: { inventory_quantity: { gt: 0 } },
      })
    }

    const result = await elasticsearch.search({
      index: "products",
      body: searchBody,
      size: filters.limit || 20,
      from: filters.offset || 0,
    })

    return {
      products: result.body.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
        _highlights: hit.highlight,
      })),
      suggestions: result.body.suggest?.product_suggest?.[0]?.options || [],
      total: result.body.hits.total.value,
    }
  } catch (error) {
    console.error("Search error:", error)
    return { products: [], suggestions: [], total: 0 }
  }
}
