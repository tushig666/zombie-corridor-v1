'use server';
/**
 * @fileOverview An AI agent that dynamically adjusts game difficulty based on player performance in "Zombie Corridor".
 *
 * - zombieDifficultyScaler - A function that calculates and recommends difficulty adjustments.
 * - ZombieDifficultyScalerInput - The input type for the zombieDifficultyScaler function.
 * - ZombieDifficultyScalerOutput - The return type for the zombieDifficultyScaler function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ZombieDifficultyScalerInputSchema = z.object({
  distanceTraveled: z.number().describe('The total distance the player has traveled in meters.'),
  zombieKillCount: z.number().describe('The total number of zombies the player has killed.'),
  totalDamageTaken: z.number().describe('The total damage the player has taken.'),
  timeSinceLastAdjustment: z.number().describe('The time in seconds since the last difficulty adjustment was made. Use this to calculate rates.'),
  lastSpawnRateModifier: z.number().describe('The current spawn rate modifier (e.g., 1.0 is default, 1.5 means 50% faster spawning).'),
  lastZombieSpeedModifier: z.number().describe('The current global zombie speed modifier (e.g., 1.0 is default, 1.2 means 20% faster zombies).'),
  lastEliteChanceIncrease: z.number().describe('The current absolute increase in elite zombie spawn chance (e.g., 0.05 means 5% increased chance).')
});
export type ZombieDifficultyScalerInput = z.infer<typeof ZombieDifficultyScalerInputSchema>;

const ZombieDifficultyScalerOutputSchema = z.object({
  spawnRateModifierAdjustment: z.number().min(0.8).max(1.2).describe('A factor to multiply the current spawn rate modifier by. E.g., 1.1 for a 10% increase, 0.9 for a 10% decrease. Should be between 0.8 and 1.2.'),
  zombieSpeedModifierAdjustment: z.number().min(0.9).max(1.1).describe('A factor to multiply the current zombie speed modifier by. E.g., 1.05 for a 5% increase, 0.95 for a 5% decrease. Should be between 0.9 and 1.1.'),
  eliteZombieChanceIncreaseAdjustment: z.number().min(-0.05).max(0.05).describe('A small decimal value to add to the current elite zombie chance increase. E.g., 0.01 for a 1% absolute increase, -0.01 for a 1% absolute decrease. Should be between -0.05 and 0.05.'),
  justification: z.string().describe('A brief explanation for the recommended adjustments.')
});
export type ZombieDifficultyScalerOutput = z.infer<typeof ZombieDifficultyScalerOutputSchema>;

export async function zombieDifficultyScaler(input: ZombieDifficultyScalerInput): Promise<ZombieDifficultyScalerOutput> {
  try {
    return await zombieDifficultyScalerFlow(input);
  } catch (error) {
    // Return a neutral fallback if the AI service is unavailable or quota is exceeded
    return {
      spawnRateModifierAdjustment: 1.0,
      zombieSpeedModifierAdjustment: 1.0,
      eliteZombieChanceIncreaseAdjustment: 0.0,
      justification: "System stabilizer active: Maintaining current difficulty due to high facility load."
    };
  }
}

const prompt = ai.definePrompt({
  name: 'zombieDifficultyScalerPrompt',
  input: {schema: ZombieDifficultyScalerInputSchema},
  output: {schema: ZombieDifficultyScalerOutputSchema},
  prompt: `You are an AI game designer for "Zombie Corridor", an endless first-person zombie survival game.\nYour goal is to dynamically adjust game difficulty to maintain a continuously challenging and engaging experience for the player.\nThe player runs through an infinite corridor, shooting zombies and avoiding a collapse wall from behind.\n\nAnalyze the provided player performance metrics and current difficulty settings, then recommend subtle adjustments to the game's difficulty.\nFocus on making incremental changes to keep the game balanced and fair, avoiding sudden spikes or drops in difficulty.\n\nConsider the following:\n-   Higher kill counts and longer distances suggest the player is performing well, indicating a need to increase difficulty.\n-   Higher damage taken or low kill counts might suggest the player is struggling, indicating a need to slightly decrease or maintain difficulty.\n-   Small, incremental adjustments are key for a smooth experience.\n\nPlayer Performance and Current State:\n-   Distance Traveled: {{{distanceTraveled}}} meters\n-   Zombie Kill Count: {{{zombieKillCount}}}\n-   Total Damage Taken: {{{totalDamageTaken}}}\n-   Time Since Last Adjustment: {{{timeSinceLastAdjustment}}} seconds\n-   Current Spawn Rate Modifier: {{{lastSpawnRateModifier}}}\n-   Current Zombie Speed Modifier: {{{lastZombieSpeedModifier}}}\n-   Current Elite Zombie Chance Increase: {{{lastEliteChanceIncrease}}}\n\nCalculate the player's kill rate (zombieKillCount / timeSinceLastAdjustment) and damage taken rate (totalDamageTaken / timeSinceLastAdjustment) to inform your decision.\n\nBased on this, recommend adjustments to the spawn rate, zombie speed, and elite zombie chance.\nEnsure your adjustments are within the specified ranges to prevent extreme changes.\nProvide a clear justification for your recommendations.\n`
});

const zombieDifficultyScalerFlow = ai.defineFlow(
  {
    name: 'zombieDifficultyScalerFlow',
    inputSchema: ZombieDifficultyScalerInputSchema,
    outputSchema: ZombieDifficultyScalerOutputSchema
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
