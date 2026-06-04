'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating a post-game performance review.
 *
 * - postGamePerformanceReview - A function that handles the post-game analysis process.
 * - PostGamePerformanceReviewInput - The input type for the postGamePerformanceReview function.
 * - PostGamePerformanceReviewOutput - The return type for the postGamePerformanceReview function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PostGamePerformanceReviewInputSchema = z.object({
  zombiesKilled: z
    .record(z.string(), z.number())
    .describe('An object mapping zombie types to the count killed.'),
  accuracy: z.number().describe('The player\'s shooting accuracy as a percentage (0-100).'),
  distanceTraveled: z.number().describe('The total distance traveled in meters.'),
  survivalTime: z.number().describe('The total survival time in seconds.'),
  highestScore: z.number().describe('The final score achieved in the game.'),
});
export type PostGamePerformanceReviewInput = z.infer<
  typeof PostGamePerformanceReviewInputSchema
>;

const PostGamePerformanceReviewOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise summary of the player\'s overall performance in the game.'),
  achievementsHighlighted: z
    .array(z.string())
    .describe('A list of specific achievements or notable aspects of the player\'s run.'),
  improvementStrategies: z
    .array(z.string())
    .describe('A list of actionable strategies for the player to improve in their next run.'),
});
export type PostGamePerformanceReviewOutput = z.infer<
  typeof PostGamePerformanceReviewOutputSchema
>;

export async function postGamePerformanceReview(
  input: PostGamePerformanceReviewInput
): Promise<PostGamePerformanceReviewOutput> {
  return postGamePerformanceReviewFlow(input);
}

const reviewPrompt = ai.definePrompt({
  name: 'postGamePerformanceReviewPrompt',
  input: {schema: PostGamePerformanceReviewInputSchema},
  output: {schema: PostGamePerformanceReviewOutputSchema},
  prompt: `You are an expert game analyst for the game "Zombie Corridor". Your task is to provide a comprehensive post-game review for a player, based on their performance statistics.

Analyze the following player data:
- Zombies Killed: {{{json zombiesKilled}}}
- Accuracy: {{{accuracy}}}%
- Distance Traveled: {{{distanceTraveled}}}m
- Survival Time: {{{survivalTime}}} seconds
- Highest Score: {{{highestScore}}}

Based on this data, generate:
1.  A concise summary of the player's overall performance.
2.  Highlight any specific achievements or notable aspects of their run (e.g., high kill count of a specific zombie type, impressive distance, long survival).
3.  Provide actionable and specific strategies for the player to improve their next run. Focus on areas like combat efficiency, movement, and score optimization.

Ensure the output is in the specified JSON format.`,
});

const postGamePerformanceReviewFlow = ai.defineFlow(
  {
    name: 'postGamePerformanceReviewFlow',
    inputSchema: PostGamePerformanceReviewInputSchema,
    outputSchema: PostGamePerformanceReviewOutputSchema,
  },
  async input => {
    const {output} = await reviewPrompt(input);
    if (!output) {
      throw new Error('Failed to generate post-game review.');
    }
    return output;
  }
);
