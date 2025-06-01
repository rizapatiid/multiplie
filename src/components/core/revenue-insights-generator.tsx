"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, AlertTriangle, CheckCircle } from 'lucide-react';
import { analyzeRevenueInsights, type AnalyzeRevenueInsightsInput } from '@/ai/flows/analyze-revenue-insights';
import type { DistributionDataEntry } from '@/types';

interface RevenueInsightsGeneratorProps {
  data: DistributionDataEntry[]; // Pass full data to pre-fill or summarize
}

function summarizeDataForAI(data: DistributionDataEntry[]): string {
  if (!data || data.length === 0) {
    return "No music distribution data available.";
  }

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalStreams = data.reduce((sum, item) => sum + item.streamCount, 0);
  const uniqueTracks = new Set(data.map(item => item.trackName)).size;
  const uniquePlatforms = new Set(data.map(item => item.platform)).size;
  
  const platformBreakdown = data.reduce((acc, item) => {
    acc[item.platform] = (acc[item.platform] || { revenue: 0, streams: 0 });
    acc[item.platform].revenue += item.revenue;
    acc[item.platform].streams += item.streamCount;
    return acc;
  }, {} as Record<string, {revenue: number, streams: number}>);

  let summary = `Royalty Statement Summary:\n`;
  summary += `- Total Revenue: $${totalRevenue.toFixed(2)}\n`;
  summary += `- Total Streams: ${totalStreams.toLocaleString()}\n`;
  summary += `- Unique Tracks: ${uniqueTracks}\n`;
  summary += `- Distributed on ${uniquePlatforms} platforms.\n\nPlatform Performance:\n`;

  for (const [platform, stats] of Object.entries(platformBreakdown)) {
    summary += `- ${platform}: Revenue $${stats.revenue.toFixed(2)}, Streams ${stats.streams.toLocaleString()}\n`;
  }
  
  // Add top 5 tracks by revenue
  const topTracks = [...data]
    .sort((a,b) => b.revenue - a.revenue)
    .slice(0,5)
    .map(t => `- ${t.trackName} by ${t.artistName}: $${t.revenue.toFixed(2)} across platforms.`);
  
  summary += `\nTop Performing Tracks (by revenue):\n${topTracks.join('\n')}\n`;

  return summary;
}


export function RevenueInsightsGenerator({ data }: RevenueInsightsGeneratorProps) {
  const [royaltyStatement, setRoyaltyStatement] = useState(() => summarizeDataForAI(data));
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setRoyaltyStatement(summarizeDataForAI(data));
  }, [data]);


  const handleGenerateInsights = async () => {
    if (!royaltyStatement.trim()) {
      setError('Please provide a royalty statement or ensure data is loaded to auto-summarize.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setInsights(null);

    try {
      const input: AnalyzeRevenueInsightsInput = { royaltyStatement };
      const result = await analyzeRevenueInsights(input);
      setInsights(result.insights);
    } catch (err: any) {
      setError(`Failed to generate insights: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full animate-fade-in">
      <CardHeader>
        <CardTitle className="font-headline flex items-center">
          <Wand2 className="mr-2 h-6 w-6 text-accent" />
          AI Revenue Insights
        </CardTitle>
        <CardDescription>
          Paste your royalty statement summary (or use auto-generated summary from imported data) to get AI-powered suggestions for growing revenue or cutting expenses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste your royalty statement here, or it will be auto-filled if data is imported..."
          value={royaltyStatement}
          onChange={(e) => setRoyaltyStatement(e.target.value)}
          rows={10}
          className="bg-background/70"
          disabled={isLoading}
        />
        <Button onClick={handleGenerateInsights} disabled={isLoading || !royaltyStatement.trim()} className="w-full sm:w-auto">
          {isLoading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Insights...
            </div>
          ) : (
            <> <Wand2 className="mr-2 h-5 w-5" /> Generate Insights</>
          )}
        </Button>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {insights && (
          <Card className="mt-6 bg-secondary/50">
            <CardHeader>
              <CardTitle className="font-headline text-lg flex items-center">
                <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                Generated Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm font-body leading-relaxed bg-background p-4 rounded-md shadow">
                {insights}
              </pre>
            </CardContent>
          </Card>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          <AlertTriangle className="inline h-3 w-3 mr-1" />
          AI-generated advice is for informational purposes only. Use at your own risk.
        </p>
      </CardFooter>
    </Card>
  );
}
