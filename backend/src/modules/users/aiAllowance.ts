import type { IsoDate } from '@gastos/shared';
import { AiLimitError, NotFoundError } from '../../core/errors/errors';
import type { UserRecord, UsersRepository } from './users.repository';

export interface AiAllowanceOptions {
  /** Today's calendar day in the app's time zone: the limit counts per day. */
  today: () => IsoDate;
  /** Documents a user can send per day when the admin gave them no limit of their own. */
  dailyReadings: number;
}

/**
 * How many documents each user can send to the AI per day. Only the users'
 * repository and the calendar are needed, so it is built before anything
 * else: the documents service asks it, and the users service shows its numbers.
 */
export function createAiAllowance(
  repository: Pick<UsersRepository, 'findById' | 'takeAiReading'>,
  options: AiAllowanceOptions,
) {
  const limitOf = (user: Pick<UserRecord, 'aiDailyLimit'>) => user.aiDailyLimit ?? options.dailyReadings;

  return {
    limitOf,

    /** Documents the user sent today; a count from an earlier day is no longer theirs. */
    readingsToday(user: Pick<UserRecord, 'aiUsage'>): number {
      return user.aiUsage?.day === options.today() ? user.aiUsage.count : 0;
    },

    /** Counts one document sent to the AI today, or refuses once the user reached their limit. */
    async take(userId: string): Promise<void> {
      const user = await repository.findById(userId);
      if (!user) throw new NotFoundError('User', userId);
      const limit = limitOf(user);
      if (!(await repository.takeAiReading(userId, options.today(), limit))) throw new AiLimitError(limit);
    },
  };
}

export type AiAllowance = ReturnType<typeof createAiAllowance>;
