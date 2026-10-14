import { getLetters, type IssuedLetter } from '@/app/lib/api/letters';
import { generateOffer } from '@/app/lib/api/recruitment';
import {
  LetterSubmitError,
  type LetterSubmit,
} from '@/app/ui/letters/generate-letter-dialog';

/**
 * Issues an offer letter through the offer itself, for `GenerateLetterDialog`'s `submit`.
 *
 * `POST /recruitment/offers/:id/generate` rather than `POST /letters`: only the offer endpoint
 * moves the offer to issued, advances the candidate and records `letterId`. A letter composed
 * beside it would leave the offer a draft that could be generated a second time.
 *
 * The endpoint answers with the offer, so the letter it issued is read back by `letterId` — the
 * dialog's success state needs the reference number and the id to download.
 */
export function offerLetterSubmit(offerId: string, candidateId: string): LetterSubmit {
  return async ({ variables, signatoryId }) => {
    const offer = await generateOffer(offerId, { variables, signatoryId });
    const letters = await getLetters({ candidateId });
    const letter: IssuedLetter | undefined = offer.letterId
      ? letters.find((l) => l.id === offer.letterId)
      : letters.find((l) => l.letterKindKey === 'offer');
    if (!letter) {
      throw new LetterSubmitError(
        'The offer was issued, but its letter could not be loaded. It is listed under the candidate’s letters.',
      );
    }
    return letter;
  };
}
