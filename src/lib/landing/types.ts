/**
 * Landing Page CMS — Type Definitions
 */

export interface HeroContent {
    badge: string;
    headingLine1: string;
    headingHighlight: string;
    sub: string;
    ctaText: string;
}

export interface MetricItem {
    value: string;
    label: string;
}

export interface FeatureItem {
    title: string;
    desc: string;
}

export interface FeaturesContent {
    sectionLabel: string;
    sectionTitle: string;
    sectionDesc: string;
    items: FeatureItem[];
}

export interface HowItWorksStep {
    step: string;
    title: string;
    desc: string;
}

export interface HowItWorksContent {
    sectionLabel: string;
    sectionTitle: string;
    items: HowItWorksStep[];
}

export interface SocialProofCard {
    category: string;
    stat: string;
    statSuffix: string;
    result: string;
}

export interface SocialProofContent {
    sectionLabel: string;
    sectionTitle: string;
    items: SocialProofCard[];
}

export type PlanAccent = 'warm' | 'lime' | 'pink' | 'indigo';
export type BannerVariant = 'muted' | 'accent' | 'indigo';
export type FeaturePillVariant = 'warm' | 'lime';

export type FeatureRow =
    | { kind: 'ok'; text: string; pill?: { text: string; variant: FeaturePillVariant } }
    | { kind: 'no'; text: string }
    | { kind: 'section'; text: string };

export interface PriceFace {
    monthly: { value: string; strike?: string; per?: string };
    annual: { value: string; strike?: string; per?: string };
}

export interface CreditBlock {
    icon: string;
    headline: string;
    lines: string[];
    fixed?: { icon: string; text: string };
}

export interface PlanCard {
    tag: string;
    desc: string;
    accent: PlanAccent;
    banner?: { text: string; variant: BannerVariant };
    credit: CreditBlock;
    price: PriceFace;
    cta: { text: string; href: string };
    save?: { annual?: string; monthly?: string };
    features: FeatureRow[];
    showDiscountBadge?: boolean;
    featured?: boolean;
}

export interface PricingContent {
    eyebrowNum: string;
    sectionLabel: string;
    headlineLines: { line1: string; emphasis: string; gradient: string };
    lede: string;
    toggle: { defaultMode: 'monthly' | 'annual'; savePill: string; discountBadge: string };
    trustLine: string[];
    lite: PlanCard;
    starter: PlanCard;
    pro: PlanCard;
    business: PlanCard;
}

export interface ComparisonRow {
    name: string;
    lite: string | boolean;
    starter: string | boolean;
    pro: string | boolean;
    enterprise: string | boolean;
}

export interface FaqItem {
    q: string;
    a: string;
}

export interface FaqContent {
    sectionLabel: string;
    sectionTitle: string;
    items: FaqItem[];
}

export interface CtaContent {
    heading: string;
    sub: string;
    buttonText: string;
    linkText: string;
}

export interface LandingContent {
    hero: HeroContent;
    metrics: MetricItem[];
    features: FeaturesContent;
    how_it_works: HowItWorksContent;
    social_proof: SocialProofContent;
    pricing: PricingContent;
    comparison: ComparisonRow[];
    faq: FaqContent;
    cta: CtaContent;
}
