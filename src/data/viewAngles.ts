export interface ViewAngle {
  label: string
  /** Camera description spliced into the mockup prompt. */
  prompt: string
}

/**
 * Turntable positions for the on-car preview, ordered so stepping through them
 * reads as walking around the car.
 *
 * Only the first matches Tesla's reference render. The others require the model to
 * extrapolate sides and rear it cannot see, so they're less reliable — which is
 * why each is generated on demand rather than all up front.
 */
export const VIEW_ANGLES: ViewAngle[] = [
  {
    label: 'Front ¾',
    prompt:
      'a front three-quarter view from the front left, the same camera angle as the reference render, showing the hood, the front bumper and the left flank',
  },
  {
    label: 'Side',
    prompt:
      'a direct side-on profile view of the left side, showing the full length of the car from front bumper to rear bumper with both wheels visible',
  },
  {
    label: 'Rear ¾',
    prompt:
      'a rear three-quarter view from the rear left, showing the tailgate, the rear bumper and the left flank',
  },
  {
    label: 'Front',
    prompt: 'a straight-on head-on view from directly in front of the car, showing the full width of the nose',
  },
]
