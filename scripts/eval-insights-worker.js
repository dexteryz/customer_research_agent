var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
require('dotenv/config');
var createClient = require('@supabase/supabase-js').createClient;
var ChatAnthropic = require('@langchain/anthropic').ChatAnthropic;
var RunnableSequence = require('@langchain/core/runnables').RunnableSequence;
var PromptTemplate = require('@langchain/core/prompts').PromptTemplate;
// Check if required environment variables are set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables. Worker will not function properly.');
    process.exit(1);
}
if (!process.env.CLAUDE_API_KEY) {
    console.error('Missing Claude API key. Worker will not function properly.');
    process.exit(1);
}
var supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// Test Supabase connection
function testConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var error, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, supabase.from('llm_insights').select('count', { count: 'exact', head: true })];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        console.error('Supabase connection test failed:', error.message);
                        return [2 /*return*/, false];
                    }
                    console.log('Eval worker: Supabase connection successful');
                    return [2 /*return*/, true];
                case 2:
                    err_1 = _a.sent();
                    console.error('Supabase connection test error:', err_1);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
var llm = new ChatAnthropic({
    apiKey: process.env.CLAUDE_API_KEY,
    model: 'claude-3-5-sonnet-20240620',
    temperature: 0,
    maxTokens: 1024,
});
var hallucinationPrompt = new PromptTemplate({
    template: "You are evaluating whether a customer insight is grounded in the source content or contains fabricated information.\n\n    # Topic Category: {query}\n    # Source Content: {reference}\n    # Customer Insight: {response}\n\nDetermine if the Customer Insight is factually supported by the Source Content:\n\n- \"factual\" means the insight accurately reflects information found in the source content\n- \"hallucinated\" means the insight contains claims, details, or implications not supported by the source content\n\nFor recommendations and summaries: Be more lenient - they can extrapolate reasonably from the source as long as the core claims are grounded.\n\nFor quotes: Must be directly supported by the source content.\n\nYour response must be a single word: either \"factual\" or \"hallucinated\".",
    inputVariables: ['query', 'reference', 'response'],
});
var relevancePrompt = new PromptTemplate({
    template: "You are evaluating whether a customer insight is correctly categorized under a specific topic category. Here is the data:\n    [BEGIN DATA]\n    ************\n    [Topic Category]: {query}\n    ************\n    [Customer Insight]: {reference}\n    [END DATA]\n\nEvaluate whether the Customer Insight above is correctly categorized under the Topic Category.\n\nTopic Category Definitions:\n- \"Pain Points\": Emotional frustrations, stress, confusion, dissatisfaction, negative experiences, user difficulties, workflow friction, or anything that causes customer discomfort or annoyance\n- \"Blockers\": Technical barriers, implementation obstacles, system limitations, process bottlenecks, missing capabilities, API issues, integration problems, or anything that prevents customers from completing tasks or achieving goals\n- \"Customer Requests\": Explicit asks for new features, enhancements, services, program improvements, integrations, or any specific functionality customers want added or changed\n- \"Solution Feedback\": Feedback on existing solutions, current feature performance, user experience reports, product effectiveness, or opinions about how well current offerings work\n\nYour response must be a single word, either \"relevant\" or \"unrelated\",\nand should not contain any text or characters aside from that word.\n\"relevant\" means the insight correctly belongs in this topic category.\n\"unrelated\" means the insight does not belong in this topic category.",
    inputVariables: ['query', 'reference'],
});
function evalInsight(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var hallucination, hallucinationChain, hallucinationResult, hallucinationText, err_2, relevance, relevanceChain, relevanceResult, relevanceText, err_3;
        var insight = _b.insight, originalData = _b.originalData, mode = _b.mode;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    hallucination = 'factual';
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    hallucinationChain = RunnableSequence.from([hallucinationPrompt, llm]);
                    return [4 /*yield*/, hallucinationChain.invoke({
                            query: mode,
                            reference: typeof originalData === 'string' ? originalData : JSON.stringify(originalData),
                            response: insight,
                        })];
                case 2:
                    hallucinationResult = _c.sent();
                    hallucinationText = typeof hallucinationResult === 'string' ? hallucinationResult : (hallucinationResult.text || '');
                    if (hallucinationText.trim().toLowerCase().startsWith('hallucinated'))
                        hallucination = 'hallucinated';
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _c.sent();
                    console.error('Hallucination eval error:', err_2);
                    return [3 /*break*/, 4];
                case 4:
                    relevance = 'relevant';
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 7, , 8]);
                    relevanceChain = RunnableSequence.from([relevancePrompt, llm]);
                    return [4 /*yield*/, relevanceChain.invoke({
                            query: mode, // This should be the topic category name
                            reference: insight, // The insight content to evaluate
                        })];
                case 6:
                    relevanceResult = _c.sent();
                    relevanceText = typeof relevanceResult === 'string' ? relevanceResult : (relevanceResult.text || '');
                    if (relevanceText.trim().toLowerCase().startsWith('unrelated'))
                        relevance = 'unrelated';
                    return [3 /*break*/, 8];
                case 7:
                    err_3 = _c.sent();
                    console.error('Relevance eval error:', err_3);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/, { hallucination: hallucination, relevance: relevance }];
            }
        });
    });
}
var isRunning = false;
function processInsights() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, insights, error, updated, performanceMetrics_1, batchSize, i, batch, batchPromises, results, batchUpdated, err_4;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (isRunning) {
                        console.log('Eval worker: previous run still in progress, skipping this interval.');
                        return [2 /*return*/];
                    }
                    // Check if we have required environment variables before proceeding
                    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.CLAUDE_API_KEY) {
                        console.log('Eval worker: Missing required environment variables, skipping processing.');
                        return [2 /*return*/];
                    }
                    isRunning = true;
                    console.log("[".concat(new Date().toISOString(), "] Eval worker: Querying unevaluated insights..."));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 8, , 9]);
                    return [4 /*yield*/, supabase
                            .from('llm_insights')
                            .select('*')
                            .is('metadata->eval', null)
                            .limit(20)];
                case 2:
                    _a = _b.sent(), insights = _a.data, error = _a.error;
                    if (error) {
                        console.error('Error querying insights:', {
                            message: error.message || 'Unknown error',
                            details: error.details || 'No details available',
                            hint: error.hint || '',
                            code: error.code || ''
                        });
                        isRunning = false;
                        return [2 /*return*/];
                    }
                    if (!insights || insights.length === 0) {
                        console.log('No unevaluated insights found.');
                        isRunning = false;
                        return [2 /*return*/];
                    }
                    console.log("Found ".concat(insights.length, " unevaluated insights."));
                    updated = 0;
                    performanceMetrics_1 = {
                        totalInsights: insights.length,
                        byType: {},
                        relevanceStats: { relevant: 0, unrelated: 0 },
                        hallucinationStats: { factual: 0, hallucinated: 0 }
                    };
                    batchSize = 5;
                    i = 0;
                    _b.label = 3;
                case 3:
                    if (!(i < insights.length)) return [3 /*break*/, 7];
                    batch = insights.slice(i, i + batchSize);
                    console.log("Processing batch ".concat(Math.floor(i / batchSize) + 1, "/").concat(Math.ceil(insights.length / batchSize), " (").concat(batch.length, " insights)"));
                    batchPromises = batch.map(function (insight) { return __awaiter(_this, void 0, void 0, function () {
                        var id, content, insight_type, metadata, mode, originalData, topicCategory, chunkId, _a, chunkData, chunkError, _b, evalResult, newMetadata, updateError, error_1;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    id = insight.id, content = insight.content, insight_type = insight.insight_type, metadata = insight.metadata;
                                    mode = insight_type;
                                    originalData = '';
                                    topicCategory = '';
                                    // Extract the topic category from the insight_type and metadata
                                    if (insight_type.includes('pain_points')) {
                                        topicCategory = 'Pain Points';
                                    }
                                    else if (insight_type.includes('blockers')) {
                                        topicCategory = 'Blockers';
                                    }
                                    else if (insight_type.includes('customer_requests')) {
                                        topicCategory = 'Customer Requests';
                                    }
                                    else if (insight_type.includes('solution_feedback')) {
                                        topicCategory = 'Solution Feedback';
                                    }
                                    else if (metadata === null || metadata === void 0 ? void 0 : metadata.topic) {
                                        topicCategory = metadata.topic;
                                    }
                                    else {
                                        topicCategory = 'Unknown';
                                    }
                                    // Set mode to the topic category for relevance evaluation
                                    mode = topicCategory;
                                    if (!insight_type.includes('quote')) return [3 /*break*/, 7];
                                    chunkId = metadata === null || metadata === void 0 ? void 0 : metadata.chunk_id;
                                    if (!chunkId) return [3 /*break*/, 5];
                                    _c.label = 1;
                                case 1:
                                    _c.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, supabase
                                            .from('file_chunks')
                                            .select('content')
                                            .eq('id', chunkId)
                                            .single()];
                                case 2:
                                    _a = _c.sent(), chunkData = _a.data, chunkError = _a.error;
                                    if (!chunkError && chunkData) {
                                        originalData = chunkData.content;
                                    }
                                    else {
                                        originalData = "Topic: ".concat((metadata === null || metadata === void 0 ? void 0 : metadata.topic) || 'Unknown');
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    _b = _c.sent();
                                    originalData = "Topic: ".concat((metadata === null || metadata === void 0 ? void 0 : metadata.topic) || 'Unknown');
                                    return [3 /*break*/, 4];
                                case 4: return [3 /*break*/, 6];
                                case 5:
                                    originalData = "Topic: ".concat((metadata === null || metadata === void 0 ? void 0 : metadata.topic) || 'Unknown');
                                    _c.label = 6;
                                case 6: return [3 /*break*/, 8];
                                case 7:
                                    // For recommendations and summaries, use metadata
                                    originalData = (metadata === null || metadata === void 0 ? void 0 : metadata.summary) || (metadata === null || metadata === void 0 ? void 0 : metadata.topic) || JSON.stringify(metadata) || '';
                                    _c.label = 8;
                                case 8:
                                    _c.trys.push([8, 11, , 12]);
                                    return [4 /*yield*/, evalInsight({
                                            insight: content,
                                            originalData: originalData,
                                            mode: mode
                                        })];
                                case 9:
                                    evalResult = _c.sent();
                                    newMetadata = __assign(__assign({}, metadata), { eval: __assign(__assign({}, evalResult), { evaluated_at: new Date().toISOString(), mode: mode }) });
                                    return [4 /*yield*/, supabase
                                            .from('llm_insights')
                                            .update({ metadata: newMetadata })
                                            .eq('id', id)];
                                case 10:
                                    updateError = (_c.sent()).error;
                                    if (updateError) {
                                        console.error("Failed to update eval for insight ".concat(id, ":"), updateError);
                                        return [2 /*return*/, { success: false, id: id }];
                                    }
                                    else {
                                        console.log("\u2713 Updated eval for insight ".concat(id, " (").concat(insight_type, " -> ").concat(topicCategory, "):"), evalResult);
                                        // Track performance metrics
                                        performanceMetrics_1.byType[topicCategory] = (performanceMetrics_1.byType[topicCategory] || 0) + 1;
                                        performanceMetrics_1.relevanceStats[evalResult.relevance]++;
                                        performanceMetrics_1.hallucinationStats[evalResult.hallucination]++;
                                        return [2 /*return*/, { success: true, id: id, evalResult: evalResult }];
                                    }
                                    return [3 /*break*/, 12];
                                case 11:
                                    error_1 = _c.sent();
                                    console.error("Error evaluating insight ".concat(id, ":"), error_1);
                                    return [2 /*return*/, { success: false, id: id, error: error_1 }];
                                case 12: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.allSettled(batchPromises)];
                case 4:
                    results = _b.sent();
                    batchUpdated = results.filter(function (r) {
                        return r.status === 'fulfilled' && r.value.success;
                    }).length;
                    updated += batchUpdated;
                    if (!(i + batchSize < insights.length)) return [3 /*break*/, 6];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    i += batchSize;
                    return [3 /*break*/, 3];
                case 7:
                    console.log("\u2705 Eval complete. Updated ".concat(updated, "/").concat(insights.length, " insights."));
                    // Performance summary
                    if (updated > 0) {
                        console.log('\n📊 Performance Summary:');
                        console.log("  Relevance: ".concat(performanceMetrics_1.relevanceStats.relevant, "/").concat(updated, " relevant (").concat(Math.round(100 * performanceMetrics_1.relevanceStats.relevant / updated), "%)"));
                        console.log("  Quality: ".concat(performanceMetrics_1.hallucinationStats.factual, "/").concat(updated, " factual (").concat(Math.round(100 * performanceMetrics_1.hallucinationStats.factual / updated), "%)"));
                        console.log('  By Category:');
                        Object.entries(performanceMetrics_1.byType).forEach(function (_a) {
                            var category = _a[0], count = _a[1];
                            console.log("    ".concat(category, ": ").concat(count, " insights"));
                        });
                    }
                    return [3 /*break*/, 9];
                case 8:
                    err_4 = _b.sent();
                    console.error('Fatal error in eval worker:', err_4);
                    return [3 /*break*/, 9];
                case 9:
                    isRunning = false;
                    return [2 /*return*/];
            }
        });
    });
}
// Run immediately, then every 2 minutes for faster evaluation of new insights
// Wait 10 seconds before first run to ensure server is ready
setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
    var connected;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('Eval worker: Starting processing after initial delay...');
                return [4 /*yield*/, testConnection()];
            case 1:
                connected = _a.sent();
                if (connected) {
                    processInsights(); // Run immediately after delay if connection is good
                }
                else {
                    console.log('Eval worker: Skipping initial run due to connection issues');
                }
                return [2 /*return*/];
        }
    });
}); }, 10000);
// Check every 2 minutes for new insights to evaluate
var interval = setInterval(processInsights, 2 * 60 * 1000);
// Graceful shutdown
function shutdown() {
    console.log('Eval worker shutting down...');
    clearInterval(interval);
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
