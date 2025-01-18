console.log('-+-+-');
import fs from 'fs';
import { GameState } from '$lib/StateManager.svelte';
import {
	fileCalcDistribution,
	fileVerifyIntegrity,
	fileParseAll,
	fileParseFindLine
} from '$lib/StateManager.svelte';

const file = '/home/alt/Downloads/WingsDanceRecord-2024-11-29T10_36_37.315Z-IN-fun.wdcap';
// const file = '/home/alt/Downloads/WingsDanceRecord-2024-12-01T11_57_56.622Z.wdcap';

const data = fs.readFileSync(file, null);
const gs = new GameState(data);

// console.log(gs.line_pointers)

gs.get_nearest_keyframe(14032);

// const result = fileParseFindLine(data, 9)
// const result = fileParseAll(data, 162, Infinity)
// const result = fileCalcDistribution(data);
// console.log(result)
// console.log(data.subarray(29135+7, 29135+78+7).toString('hex'))

// console.log(JSON.stringify(result, null, 2));
