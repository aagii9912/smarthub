/**
 * Read-only shop snapshot + Gemini token measurement (no customer messages).
 * node scripts/measure-ai-context.cjs SHOP_ID [--live]
 * --live generates test replies; only the read-only description tool executes.
 * Transactional tools are NEVER executed. No shop counters are updated.
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
// Load the app's actual TypeScript builders without a second implementation.
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
    return resolve.call(this, name.startsWith('@/') ? path.resolve('src', name.slice(2)) : name, ...args);
};
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
    fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } },
).outputText, filename);

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildSystemPrompt } = require('../src/lib/ai/services/PromptService.ts');
const { PRODUCT_DETAILS_TOOL, getProductDetails, needsProductDetails } = require('../src/lib/ai/services/ProductContext.ts');
const { getToolsForAgent } = require('../src/lib/ai/AIRouter.ts');
const { getPlanConfig, getPlanTypeFromSubscription } = require('../src/lib/ai/config/plans.ts');
const { mapShopProductsToAI, getAIFeatures, buildPaymentConfig, buildCrossCuttingConfig } = require('../src/lib/webhook/services/shop.service.ts');

async function main() {
    const shopId = process.argv[2];
    if (!shopId || shopId.startsWith('--')) throw new Error('Provide SHOP_ID');
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Select only prompt settings and products; never retrieve channel tokens.
    const { data: shop, error } = await db.from('shops').select([
        'id', 'name', 'description', 'ai_instructions', 'ai_emotion', 'ai_agent_role',
        'ai_agent_capabilities', 'ai_agent_name', 'ai_agent_config', 'custom_knowledge',
        'business_type', 'business_setup_data', 'subscription_plan', 'subscription_status', 'working_hours_structured',
        'accepted_payment_methods', 'qpay_status', 'bank_name', 'account_name', 'account_number',
        'phone', 'address', 'business_hours', 'ai_share_phone', 'ai_share_address', 'ai_share_hours',
        'ai_share_policies', 'ai_share_description', 'delivery_policy', 'products(*)',
    ].join(',')).eq('id', shopId).eq('products.is_active', true).single();
    if (error) throw new Error(error.message);
    const plan = getPlanTypeFromSubscription({ plan: shop.subscription_plan, status: shop.subscription_status });
    const config = getPlanConfig(plan);
    const { data: planRow, error: planError } = await db.from('plans').select('enabled_tools').eq('slug', plan).maybeSingle();
    if (planError) throw new Error(planError.message);
    const context = {
        shopId, shopName: shop.name, shopDescription: shop.description,
        aiInstructions: shop.ai_instructions, aiEmotion: shop.ai_emotion,
        aiAgentRole: shop.ai_agent_role, aiAgentCapabilities: shop.ai_agent_capabilities,
        aiAgentName: shop.ai_agent_name, customKnowledge: shop.custom_knowledge,
        products: mapShopProductsToAI(shop.products),
        businessType: shop.business_type, businessSetupData: shop.business_setup_data,
        workingHoursStructured: shop.working_hours_structured,
        paymentConfig: buildPaymentConfig(shop), crossCutting: buildCrossCuttingConfig(shop),
        deliveryPolicy: shop.delivery_policy,
        shopPhone: shop.phone, shopAddress: shop.address, shopBusinessHours: shop.business_hours,
        aiShareFlags: { phone: shop.ai_share_phone, address: shop.ai_share_address,
            hours: shop.ai_share_hours, policies: shop.ai_share_policies, description: shop.ai_share_description },
        ...await getAIFeatures(shopId),
        planFeatures: { ai_model: config.model, sales_intelligence: config.features.salesIntelligence,
            ai_memory: config.features.memory, max_tokens: config.maxTokens },
    };
    const tools = getToolsForAgent({ plan, role: shop.ai_agent_role || 'sales',
        capabilities: shop.ai_agent_capabilities?.length ? shop.ai_agent_capabilities : ['sales'],
        planOverride: planRow?.enabled_tools?.length ? planRow.enabled_tools : null });
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const report = { measuredAt: new Date().toISOString(), shop: shop.name, model: config.model, plan,
        products: context.products.length, scope: 'Shop snapshot; no customer history, cart or memory. Standard uncached token price estimate, not a billing measurement.', variants: [] };
    const sample = context.products.find(p => p.status !== 'draft' && p.status !== 'discontinued' && p.description?.length > 500);
    for (const compact of [false, true]) {
        const enabled = compact && config.features.toolCalling && needsProductDetails(context.products);
        const prompt = buildSystemPrompt(context, enabled);
        const declarations = enabled ? [...tools, PRODUCT_DETAILS_TOOL] : tools;
        const model = ai.getGenerativeModel({ model: config.model, systemInstruction: prompt,
            tools: [{ functionDeclarations: declarations }],
            generationConfig: { temperature: 0, maxOutputTokens: config.maxTokens } });
        const systemTokens = await ai.getGenerativeModel({ model: config.model }).countTokens(prompt);
        const requestTokens = await model.countTokens('Сайн байна уу!');
        const variant = { compact, systemTokens: systemTokens.totalTokens,
            firstRequestTokens: requestTokens.totalTokens, cases: [] };
        if (process.argv.includes('--live')) {
            const cases = [['greeting', 'Сайн байна уу!']];
            if (sample) cases.push(['price', `${sample.name} хэдэн төгрөг вэ?`],
                ['details', `${sample.name}-ийн тайлбарт яг ямар мэдээлэл байгаа вэ? Гол мэдээллийг товч хэл.`]);
            for (const [label, message] of cases) {
                const chat = ai.getGenerativeModel({ model: config.model,
                    systemInstruction: buildSystemPrompt(context, enabled, message),
                    tools: [{ functionDeclarations: declarations }],
                    generationConfig: { temperature: 0, maxOutputTokens: config.maxTokens },
                }).startChat();
                let result = await chat.sendMessage(message);
                const calls = [];
                const usage = [];
                let response = '';
                for (let step = 0; step <= 5; step++) {
                    usage.push(result.response.usageMetadata || {});
                    const requested = result.response.functionCalls() || [];
                    calls.push(...requested.map(c => c.name));
                    response = result.response.text();
                    if (!requested.length || step === 5) break;
                    if (requested.some(c => c.name !== PRODUCT_DETAILS_TOOL.name)) {
                        response = '[Stopped: transactional tool requested; no action executed.]';
                        break;
                    }
                    result = await chat.sendMessage(requested.map(c => ({ functionResponse: {
                        name: c.name, response: getProductDetails(context.products, c.args || {}),
                    } })));
                }
                variant.cases.push({ label, apiCalls: usage.length, tools: calls, response,
                    inputTokens: usage.reduce((n, u) => n + (u.promptTokenCount || 0), 0),
                    outputTokens: usage.reduce((n, u) => n + (u.candidatesTokenCount || 0), 0),
                    totalTokens: usage.reduce((n, u) => n + (u.totalTokenCount || 0), 0) });
            }
        }
        report.variants.push(variant);
        console.error(`Measured ${compact ? 'compact' : 'original'}: ${variant.firstRequestTokens} first-request tokens`);
    }
    console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
