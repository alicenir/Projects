export type TextPlacementId = 'doors' | 'hood' | 'rear' | 'auto'

export interface TextPlacement {
  id: TextPlacementId
  label: string
  /**
   * Placement instruction, phrased in template space. Panels are laid out flat and
   * some are rotated relative to the car — the long door panels run vertically down
   * the image even though they sit horizontally along the car's flank — so the
   * orientation has to be spelled out or lettering ends up sideways once applied.
   */
  prompt: string
}

export const TEXT_PLACEMENTS: TextPlacement[] = [
  {
    id: 'doors',
    label: 'Side doors',
    prompt:
      'Place the lettering on the tall door panels running down the left and right sides of the image. Those panels are rotated in this flat layout: the panel\'s long axis runs vertically down the image but sits horizontally along the car\'s flank, so set the text along that long vertical axis, reading from the top of the panel downwards, so it reads horizontally front-to-back once applied to the car.',
  },
  {
    id: 'hood',
    label: 'Hood / frunk',
    prompt:
      'Place the lettering across the large hood panel near the top centre of the image, running left to right across the panel and oriented toward the top edge of the image, which is the nose of the car.',
  },
  {
    id: 'rear',
    label: 'Rear / tailgate',
    prompt:
      'Place the lettering on the wide panels along the bottom of the image, which are the rear tailgate and bumper, running left to right across them.',
  },
  {
    id: 'auto',
    label: 'Wherever it fits best',
    prompt:
      'Place the lettering wherever it sits best in the design — most often along the door panels or across the hood — at a size that stays clearly legible.',
  },
]
