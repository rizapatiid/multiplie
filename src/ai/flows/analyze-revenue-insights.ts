'use server';

/**
 * @fileOverview A revenue insights AI agent.
 *
 * - analyzeRevenueInsights - A function that handles the revenue insights process.
 * - AnalyzeRevenueInsightsInput - The input type for the analyzeRevenueInsights function.
 * - AnalyzeRevenueInsightsOutput - The return type for the analyzeRevenueInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeRevenueInsightsInputSchema = z.object({
  royaltyStatement: z
    .string()
    .describe('The royalty statement to analyze.'),
});
export type AnalyzeRevenueInsightsInput = z.infer<
  typeof AnalyzeRevenueInsightsInputSchema
>;

const AnalyzeRevenueInsightsOutputSchema = z.object({
  insights: z.string().describe('The insights on how to grow revenue or cut expenses.'),
});
export type AnalyzeRevenueInsightsOutput = z.infer<
  typeof AnalyzeRevenueInsightsOutputSchema
>;

export async function analyzeRevenueInsights(
  input: AnalyzeRevenueInsightsInput
): Promise<AnalyzeRevenueInsightsOutput> {
  return analyzeRevenueInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeRevenueInsightsPrompt',
  input: {schema: AnalyzeRevenueInsightsInputSchema},
  output: {schema: AnalyzeRevenueInsightsOutputSchema},
  prompt: `You are a music industry expert specializing in providing revenue insights to musicians.

You will use this royalty statement to provide insights on how to grow revenue or cut expenses.

Royalty Statement: {{{royaltyStatement}}}`,
});

const analyzeRevenueInsightsFlow = ai.defineFlow(
  {
    name: 'analyzeRevenueInsightsFlow',
    inputSchema: AnalyzeRevenueInsightsInputSchema,
    outputSchema: AnalyzeRevenueInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
