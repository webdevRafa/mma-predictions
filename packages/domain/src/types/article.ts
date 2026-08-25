export type ArticleStatus = "draft" | "review" | "published" | "archived";

export type ArticleCategory =
  | "event_guide"
  | "fight_analysis"
  | "division_analysis"
  | "prospects"
  | "news_analysis"
  | "feature";

export interface ArticleAuthor {
  id: string;
  handle: string;
  displayName: string;
  role: "editorial" | "contributor";
}

export interface ArticleSource {
  label: string;
  url: string;
  publisher: string;
  publishedAt?: string | undefined;
  accessedAt: string;
}

export type ArticleBodyBlock =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "bullet_list"; items: string[] }
  | {
      id: string;
      type: "quote";
      text: string;
      attribution?: string | undefined;
    };

export interface ArticleSeo {
  title: string;
  description: string;
  canonicalPath: string;
  keywords: string[];
}

export interface Article {
  id: string;
  slug: string;
  slugHistory: string[];
  title: string;
  dek: string;
  excerpt: string;
  category: ArticleCategory;
  tags: string[];
  status: ArticleStatus;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  author: ArticleAuthor;
  body: ArticleBodyBlock[];
  sources: ArticleSource[];
  relatedEventIds: string[];
  relatedFightIds: string[];
  featured: boolean;
  monetizationEligible: boolean;
  seo: ArticleSeo;
}
