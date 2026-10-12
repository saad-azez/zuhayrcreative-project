import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { ZMARK } from '../../layout'

/** The one pixel shape (a hair under the cell so neighbours show a seam), shared by the Z's voxels and the settled ones. */
export const VOXEL_GEO = new RoundedBoxGeometry(ZMARK.cell * 0.94, ZMARK.cell * 0.94, ZMARK.cell * 0.94, 2, 0.004)
