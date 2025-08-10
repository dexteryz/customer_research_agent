import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface EvalStats {
  totalInsights: number;
  evaluatedInsights: number;
  unevaluatedInsights: number;
  relevanceStats: {
    relevant: number;
    unrelated: number;
  };
  hallucinationStats: {
    factual: number;
    hallucinated: number;
  };
  byCategory: Record<string, {
    total: number;
    evaluated: number;
    relevant: number;
    factual: number;
    relevanceRate: number;
    factualRate: number;
  }>;
  performanceMetrics: {
    overallRelevanceRate: number;
    overallFactualRate: number;
    evaluationCoverage: number;
  };
  recentEvaluations: Array<{
    id: string;
    insight_type: string;
    content: string;
    relevance: string;
    hallucination: string;
    evaluated_at: string;
    category: string;
  }>;
  allEvaluations: Array<{
    id: string;
    insight_type: string;
    content: string;
    relevance: string;
    hallucination: string;
    evaluated_at: string;
    category: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }>;
}

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({
        status: 'error',
        message: 'Database not configured'
      }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Get all insights with evaluation data
    const { data: insights, error } = await supabase
      .from('llm_insights')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching insights for eval stats:', error);
      return NextResponse.json({
        status: 'error',
        message: 'Failed to fetch evaluation data',
        error: error.message
      }, { status: 500 });
    }

    if (!insights) {
      return NextResponse.json({
        status: 'error',
        message: 'No insights found'
      }, { status: 404 });
    }

    // Initialize statistics
    const stats: EvalStats = {
      totalInsights: insights.length,
      evaluatedInsights: 0,
      unevaluatedInsights: 0,
      relevanceStats: { relevant: 0, unrelated: 0 },
      hallucinationStats: { factual: 0, hallucinated: 0 },
      byCategory: {},
      performanceMetrics: {
        overallRelevanceRate: 0,
        overallFactualRate: 0,
        evaluationCoverage: 0
      },
      recentEvaluations: [],
      allEvaluations: []
    };

    // Process each insight
    insights.forEach((insight) => {
      const metadata = insight.metadata as Record<string, unknown>;
      const evalData = metadata?.eval as Record<string, unknown>;
      
      // Determine category from insight_type
      let category = 'Unknown';
      if (insight.insight_type.includes('pain_points')) category = 'Pain Points';
      else if (insight.insight_type.includes('blockers')) category = 'Blockers';
      else if (insight.insight_type.includes('customer_requests')) category = 'Customer Requests';
      else if (insight.insight_type.includes('solution_feedback')) category = 'Solution Feedback';
      
      // Initialize category if not exists
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = {
          total: 0,
          evaluated: 0,
          relevant: 0,
          factual: 0,
          relevanceRate: 0,
          factualRate: 0
        };
      }
      stats.byCategory[category].total++;

      // Check if evaluated
      if (evalData && evalData.evaluated_at) {
        stats.evaluatedInsights++;
        stats.byCategory[category].evaluated++;
        
        const relevance = evalData.relevance as string;
        const hallucination = evalData.hallucination as string;
        
        // Update stats
        if (relevance === 'relevant') {
          stats.relevanceStats.relevant++;
          stats.byCategory[category].relevant++;
        } else {
          stats.relevanceStats.unrelated++;
        }
        
        if (hallucination === 'factual') {
          stats.hallucinationStats.factual++;
          stats.byCategory[category].factual++;
        } else {
          stats.hallucinationStats.hallucinated++;
        }
        
        // Add to all evaluations
        stats.allEvaluations.push({
          id: insight.id,
          insight_type: insight.insight_type,
          content: insight.content,
          relevance,
          hallucination,
          evaluated_at: evalData.evaluated_at as string,
          category,
          created_at: insight.created_at,
          metadata: evalData
        });

        // Add to recent evaluations (limit to 15 most recent)
        if (stats.recentEvaluations.length < 15) {
          stats.recentEvaluations.push({
            id: insight.id,
            insight_type: insight.insight_type,
            content: insight.content.substring(0, 120) + (insight.content.length > 120 ? '...' : ''),
            relevance,
            hallucination,
            evaluated_at: evalData.evaluated_at as string,
            category
          });
        }
      } else {
        stats.unevaluatedInsights++;
      }
    });

    // Calculate performance metrics
    stats.performanceMetrics.evaluationCoverage = stats.totalInsights > 0 
      ? Math.round((stats.evaluatedInsights / stats.totalInsights) * 100) 
      : 0;
      
    stats.performanceMetrics.overallRelevanceRate = stats.evaluatedInsights > 0
      ? Math.round((stats.relevanceStats.relevant / stats.evaluatedInsights) * 100)
      : 0;
      
    stats.performanceMetrics.overallFactualRate = stats.evaluatedInsights > 0
      ? Math.round((stats.hallucinationStats.factual / stats.evaluatedInsights) * 100)
      : 0;

    // Calculate category rates
    Object.keys(stats.byCategory).forEach(category => {
      const cat = stats.byCategory[category];
      cat.relevanceRate = cat.evaluated > 0 ? Math.round((cat.relevant / cat.evaluated) * 100) : 0;
      cat.factualRate = cat.evaluated > 0 ? Math.round((cat.factual / cat.evaluated) * 100) : 0;
    });

    // Sort all evaluations by evaluated_at descending (most recent first)
    stats.allEvaluations.sort((a, b) => new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime());

    return NextResponse.json({
      status: 'success',
      worker_enabled: !!process.env.CLAUDE_API_KEY,
      last_updated: new Date().toISOString(),
      ...stats
    });

  } catch (error) {
    console.error('Error generating eval statistics:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to get evaluation status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}