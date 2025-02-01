import { Buffer } from 'buffer';
import { MessageParser } from './MessageParser';
import * as TP from '$lib/ReWings/lib/types';
// import { createHash } from 'crypto';
import { dir_type, msg_type } from './MessageParser';
import _ from 'lodash';
import { browser } from '$app/environment';
import { LRUCache } from 'lru-cache';
import * as T from '$lib/ReWings/lib/types'

// function readonlyProxy<T>(obj: T) {
// 	return new Proxy(obj as object, {
// 		set: () => {throw new Error("Cannot modify readonly object")}
// 	}) as T
// }

function clamp(min: number, max: number, value: number) {
	return Math.min(max, Math.max(min, value));
}

function interpolate(v0: number, v1: number, ratio: number) {
	return v0 + (v1 - v0)*ratio
}

export class GameState {
	planes: Record<number, TP.Plane[]> = {};
	missiles: Record<number, TP.Missile[]> = {};
	specialEntities: Record<number, TP.SpecialEntity[]> = {};

	// #sc_keyframes: { time: number; pt: number, bullet_hit?: number }[] = []; //1.1s
	#keyframes: { time: number; pt: number; sc?: boolean; sub_events?: Record<string, {time: number, pt: number}[]> }[] = []; //100ms
	#keyframes_mean: number = 0;
	#keyframes_sd: number = 0;

	#inputframes: { time: number; pt: number }[] = [];
	#inputframes_mean: number = 0;
	#inputframwa_sd: number = 0;

	#eventframes: { time: number; pt: number; type: number; dir: number }[] = [];

	#debug_messages: any[] = [];

	debug_info: any = $state();

	// line_pointers: Record<number, number> = $state({})
	line_pointers: {
		time: number;
		pt: number;
		len: number;
		dir: number;
		type: number;
		info: string;
	}[] = [];

	keyframe_mean?: number;
	keyframe_sd?: number;

	client_info!: Record<string, string>;
	server_info!: Record<string, string>;

	start_time_utc!: Date;
	start_time!: number;

	end_time_utc!: Date;
	end_time!: number;

	checksum?: Buffer;
	integritous?: boolean = $state();

	data: Buffer;
	data_cache: LRUCache<number, object>;

	constructor(data: Buffer) {
		this.data = data;
		const options = {
			max: 500,
			ttl: 1000 * 60 * 5,
			allowStale: false,
			updateAgeOnGet: true,
			updateAgeOnHas: false
		};
		this.data_cache = new LRUCache<number, object>(options);

		this.#populateKeyframes();

		// console.log(this)
		let stat = this.#calculateStatistics(this.#keyframes);
		this.#keyframes_mean = stat.mean;
		this.#keyframes_sd = stat.sd;

		stat = this.#calculateStatistics(this.#inputframes);
		this.#inputframes_mean = stat.mean;
		this.#inputframwa_sd = stat.sd;
		// const a = this.#get_nearest_keyframe(3026)
		// console.log(this.#keyframes[a])

		// console.log(this.start_time_utc)
		// console.log(this.#debug_messages[0].planes)
	}

	#ptNextMessage(pt: number) {
		return pt + 7 + this.data.readUInt16BE(pt + 5);
	}

	#getSubBuffer(pt: number) {
		return this.data.subarray(pt + 7, this.#ptNextMessage(pt));
	}

	#populateKeyframes() {
		let cache_sub_events: any = undefined; //bullet-hit event and state-update is in sync.
		const cache: Record<string, any> = {};
		let pt = 0;
		while (pt < this.data.length) {
			const time = this.data.readUInt32BE(pt);
			if (time == undefined) {
				console.warn('WTF');
				break;
			}
			const dir = this.data.readUInt8(pt + 4);
			const len = this.data.readUInt16BE(pt + 5) + 7;
			const type = this.data.readUint8(pt + 7);
			// this.line_pointers[time] = pt
			this.line_pointers.push({
				time,
				pt,
				len,
				dir,
				type,
				info: msg_type[dir][type]
			});
			if (dir == 0) {
				if ([0xa3, 0xa9, 0xa2].includes(type)) {
					this.#keyframes.push({
						time,
						pt,
						sub_events: cache_sub_events,
						sc: type != 0xa3
					});
					cache_sub_events = undefined;
				}

				if ([0xb0, 0xa4, 0xa1, 0xab, 0xa5].includes(type)) {
					cache_sub_events ??= {};
					const sub_key =
						type == 0xb0 ? 'bullet_hit' : type == 0xa5 ? 'despawn' : type == 0xa4 ? 'player_join' : 'mc_player_join';
					cache_sub_events[sub_key] ??= [];
					if ([0xa1, 0xab].includes(type)) {
						cache_sub_events[sub_key].push({ pt, time, addend_pt: cache.mc_player_join_send });
						delete cache.mc_player_join_send;
					} else {
						cache_sub_events[sub_key].push({ pt, time });
					}
				}
			}
			if (dir == 1) {
				if ([0x02, 0x08].includes(type)) {
					cache_sub_events ??= {};
					const sub_key = 'mc_player_join_send';
					cache_sub_events[sub_key] ??= [];
					cache_sub_events[sub_key].push({ pt, time });
					cache.mc_player_join_send ??= pt;
				}
				if ([0x03].includes(type)) {
					this.#inputframes.push({
						time,
						pt
					});
				}
			}
			if (!(this.start_time && this.start_time_utc) && dir == 2 && type == 0x41) {
				this.start_time = time;
				const { timestamp_start, client_info } = MessageParser.parseInfoMessage(
					this.#getSubBuffer(pt)
				);
				this.start_time_utc = new Date(Number(timestamp_start as bigint));
				this.client_info = client_info;
			}
			if (!(this.end_time && this.end_time_utc) && dir == 2 && type == 0x49) {
				this.end_time = time;
				const { timestamp_stop } = MessageParser.parseInfoMessage(this.#getSubBuffer(pt));
				this.end_time_utc = new Date(Number(timestamp_stop as bigint));
			}
			if (!this.server_info && dir == 2 && type == 0x42) {
				const { server_info } = MessageParser.parseInfoMessage(this.#getSubBuffer(pt));
				this.server_info = server_info;
			}

			// if([0x10, 0x11, 0x12, 0x13, 0x14, 0x16, 0x17, 0x15].includes(type)) {
			if ([0xa2].includes(type)) {
				const msg = MessageParser.parseReceivedMessage(this.#getSubBuffer(pt));
				this.#debug_messages.push({
					...msg,
					_type: type,
					_type_info: msg_type[0][type],
					_time: this.data.readUInt32BE(pt)
				});
			}
			pt = this.#ptNextMessage(pt);
		}
		pt = this.data.byteLength - 40;
		if (this.data.readUInt8(pt + 7) == 0x40 && this.data.readUInt16BE(pt + 5) == 33) {
			this.checksum = this.data.subarray(pt + 8, pt + 40);
		}
	}

	#calculateStatistics(array: { time: number }[]) {
		const differences = _.zipWith(array.slice(2), array.slice(1, -1), (a, b) => a.time - b.time);

		const mean = _.mean(differences);

		const start_time = array[1].time - mean;

		const sd = Math.sqrt(
			_.sum(_.map(differences, (i) => Math.pow(i - mean, 2))) / differences.length
		);

		const sdd = _.sum(_.map(differences, (i) => i - mean));

		console.log('Keyframe prediction: ', start_time, mean, sd, sdd);

		return { mean, sd };
	}

	async verifyIntegrity() {
		if (this.integritous !== undefined) {
			console.warn('Already checked for integritry once');
			return;
		}
		if (!this.checksum) {
			console.warn('No checksum present');
			return;
		}
		this.integritous =
			this.checksum.compare(
				browser
					? Buffer.from(
							await window.crypto.subtle.digest(
								'SHA-256',
								this.data.subarray(0, this.data.byteLength - 40)
							)
						)
					: (await import('crypto'))
							.createHash('sha256')
							.update(this.data.subarray(0, this.data.byteLength - 40))
							.digest()
			) == 0;
	}

	getNearestKeyframe(time: number, server_perspective = false) {
		if(server_perspective) {
			return clamp(0, this.#keyframes.length - 1, Math.floor((time - this.#keyframes[0].time)/this.#keyframes_mean))
		}

		const test_correct = (time: number, index: number) => {
			return (
				this.#keyframes[index].time <= time &&
				(this.#keyframes.length - 1 == index || time < this.#keyframes[index + 1].time)
			);
		};

		time = clamp(this.#keyframes[0].time, this.#keyframes.at(-1)!.time, time);

		let index = 1;
		let attempts = 16;
		while (attempts-- > 0) {
			let val = Math.floor((time - this.#keyframes[index].time) / this.#keyframes_mean);
			if (val == 0) val += 1; // only if initial_guess is correct, comparison happens two times.
			index += val;
			if (test_correct(time, index)) break;
		}
		if (attempts < 1) {
			console.error('SEEK STEPS EXHAUSTED');
		}

		// console.log(`SEEKED: ${index}`);
		return index;
	}

	getPlanes(time: number, server_perspective = true) {
		const start_i = this.getNearestKeyframe(time, server_perspective);
		const state = structuredClone(this.parseMessage<T.StateUpdate>(this.#keyframes[start_i].pt));
		const next_state = this.parseMessage<T.StateUpdate>(this.#keyframes[start_i + 1].pt);

		const state_time = server_perspective ? start_i * this.#keyframes_mean + this.#keyframes[0].time : state.__time
		const next_state_time = server_perspective ? state_time + this.#keyframes_mean : next_state.__time 
		
		const ratio = (time - state_time) / (next_state_time - state_time)
		if (ratio < 0) return []

		const events = this.#keyframes[start_i + 1].sub_events;
		const current_ids = Object.keys(state.planes!).map(i => parseInt(i));
		const next_ids = Object.values(next_state.planes!).filter(i => i.state.is_active).map(i => parseInt(i.id));

		const joined_ids: number[] = []
		const left_ids: number[] = []

		const interpolatePlanes = (p1: T.Plane, p2: T.Plane, ratio: number, clone?: 1 | 2) => {
			const p = clone == 1 ? structuredClone(p1) : clone == 2 ? structuredClone(p2) : p1
			p.x_gu = interpolate(p1.x_gu!, p2.x_gu!, ratio)
			p.y_gu = interpolate(p1.y_gu!, p2.y_gu!, ratio)
			p.angle = interpolate(p1.angle!, p2.angle!, ratio)
			if(clone) return p
		}

		events?.player_join?.forEach((event) => {
			// 0xA4 - Other players
			const event_msg = this.parseMessage<T.EventPlayerJoin>(event.pt)
			Object.values(event_msg.planes!).forEach((plane) => {
				joined_ids.push(plane.id)
				if(event.time <= time) {
					const ratio = (time - event.time) / (next_state_time - event.time)
					state.planes![plane.id] = interpolatePlanes(plane, next_state.planes![plane.id], ratio, 2)!
				} else {
					if(state.planes![plane.id]?.state.is_active) console.error("UNEXPECTED entity state");
				}
			})
		})

		events?.mc_player_join?.forEach((event) => {
			// 0xA1 - MC Player New
			// 0xAB - MC Player Continue
			const event_msg = this.parseMessage<T.EventMCPlayerJoin>(event.pt)
			joined_ids.push(event_msg.id)
			if(event.time <= time) {
				const ratio = (time - event.time) / (next_state_time - event.time)
				state.planes![event_msg.id] = interpolatePlanes(event_msg as T.Plane, next_state.planes![event_msg.id], ratio, 2)!
			} else {
				if(state.planes![event_msg.id]?.state.is_active) console.error("UNEXPECTED entity state");
			}
		})

		if(events?.despawn) {
			const prev_state = this.parseMessage<T.StateUpdate>(this.#keyframes[start_i > 0 ? start_i-1 : 0].pt);
			const prev_state_time = server_perspective ? state_time - this.#keyframes_mean : prev_state.__time 
			events?.despawn?.forEach((event) => {
				// 0xA5 - despawn messages
				const event_msg = this.parseMessage<T.EventDespawn>(event.pt)
				left_ids.push(event_msg.id_victim)
				if(event.time <= time) {
					state.planes![event_msg.id_victim] = next_state.planes![event_msg.id_victim]
				}
				else {
					const ratio = (time - prev_state_time) / (state_time - prev_state_time)
					console.log(ratio, prev_state.planes![event_msg.id_victim].y_gu!, prev_state.planes![event_msg.id_victim].y_gu!)
					state.planes![event_msg.id_victim] = interpolatePlanes(prev_state.planes![event_msg.id_victim], state.planes![event_msg.id_victim], ratio, 2)!
				}
			})
		}

		next_ids.forEach(id => {
			if(state.planes![id] && next_state.planes![id]) {
				interpolatePlanes(state.planes![id], next_state.planes![id], ratio)
			}
		})

		// this.debug_info = {
		// 	ratio,
		// 	start_i,
		// 	// current_ids,
		// 	// next_ids: next_ids,
		// 	// joined_ids,
		// 	// left_ids,
		// 	// differenceA: _.difference(current_ids, next_ids),
		// 	// differenceB: _.difference(next_ids, current_ids)
		// }
		// this.debug_info = start_i	
		return state.planes
	}

	parseMessage<T>(pt: number): T.Parsed<T> {
		const cached = this.data_cache.get(pt);
		if (cached) return cached as T.Parsed<T>;
		// console.log("CACHE MISS")
		const time = this.data.readUInt32BE(pt);
		const dir = this.data.readUInt8(pt + 4);
		const len = this.data.readUInt16BE(pt + 5);
		// const message = Buffer.from(new Uint8Array(data.subarray(offset+7, offset+7+len)));
		const message = this.data.subarray(pt + 7, pt + 7 + len);
		const type = this.data.readUInt8(pt + 7);
		const result =
			dir == 0
				? MessageParser.parseReceivedMessage(message)
				: dir == 1
					? MessageParser.parseSentMessage(message)
					: dir == 2
						? MessageParser.parseInfoMessage(message)
						: console.error('Unknown dir type', dir, type.toString(16));
		result.__type_info = msg_type[dir][type];
		result.__type = type.toString(16);
		result.__time = time;
		result.__dir = dir;
		this.data_cache.set(pt, result);
		return result;
	}
}

export function parseMessageStatic(buffer: Buffer, offset: number) {
	const time = buffer.readUInt32BE(offset);
	const dir = buffer.readUInt8(offset + 4);
	const len = buffer.readUInt16BE(offset + 5);
	// const message = Buffer.from(new Uint8Array(data.subarray(offset+7, offset+7+len)));
	const message = buffer.subarray(offset + 7, offset + 7 + len);
	const type = buffer.readUInt8(offset + 7);
	const result =
		dir == 0
			? MessageParser.parseReceivedMessage(message)
			: dir == 1
				? MessageParser.parseSentMessage(message)
				: dir == 2
					? MessageParser.parseInfoMessage(message)
					: console.error('Unknown dir type', dir, type.toString(16));
	result.__type_info = msg_type[dir][type];
	result.__type = type.toString(16);
	result.__time = time;
	result.__dir = dir;
	return result;
}

export function fileCalcDistribution(data: Buffer) {
	const distribution: Record<number, Record<number, { count: number; info: string }>> = {};
	Object.keys(dir_type).forEach((dir) => {
		const ndir = parseInt(dir);
		distribution[ndir] ??= {};
		Object.keys(msg_type[ndir]).forEach((type) => {
			const ntype = parseInt(type);
			distribution[ndir][ntype] = {
				count: 0,
				info: msg_type[ndir][ntype]
			};
		});
	});
	const size = data.byteLength;
	let offset = 0;
	let sample = 0;
	let line = 0;

	while (offset < size) {
		line++;
		const dir = data.readUInt8(offset + 4);
		// const time = data.readBigInt64BE(offset+1);
		const len = data.readUInt16BE(offset + 5);
		if (len + 7 > size) {
			throw new Error('Invalid length');
		}
		const type = data.readUInt8(offset + 7);
		// const message = data.subarray(offset+11, offset+11+len);
		if (sample > 0 && type == 0xa3) {
			const len = data.readUInt16BE(offset + 5);
			console.log(line, data.subarray(offset + 7, offset + 7 + len).toString('hex'));
			sample--;
		}
		distribution[dir][type].count++;
		offset += len + 7;
	}
	if (offset != size) {
		console.error('EOF not reached correctly', offset, size);
	}
	// console.log(distribution);
	return distribution;
}

// Parses only the mentioned line
export function fileParseFindLine(data: Buffer, line: number) {
	const size = data.byteLength;
	let offset = 0;
	if (line < 1) line = 1;
	while (offset < size && --line) {
		const len = data.readUInt16BE(offset + 5);
		offset += len + 7;
	}
	if (offset >= size) {
		throw new Error('File EOF reached');
	}
	// console.log(offset)
	const len = data.readUInt16BE(offset + 5);
	try {
		const result = parseMessageStatic(data, offset);
		console.log(
			offset,
			data.subarray(offset + 7, offset + 7 + len),
			data.readInt16BE(offset + 5),
			JSON.stringify(result, null, 2)
		);
	} catch (e: any) {
		console.error('Error', e, data.subarray(offset, offset + len).toString('hex'));
	}
}

// Reads all lines until the one type, prints and stops
export function fileParseAll(data: Buffer, print_type?: number, limit: number = 100) {
	const size = data.byteLength;
	let offset = 0;
	let line = 0;
	if (limit < 1) limit = 1;
	while (limit-- && offset < size) {
		line++;
		const time = data.readUInt32BE(offset);
		const dir = data.readUInt8(offset + 4);
		const len = data.readUInt16BE(offset + 5);
		if (len + 7 > size) {
			throw new Error('Invalid length');
		}
		const message = Buffer.from(new Uint8Array(data.subarray(offset + 7, offset + 7 + len)));
		const type = data.readUint8(offset + 7);
		try {
			const result = parseMessageStatic(data, offset);
			if (print_type == type) {
				// console.log(result);
				return result;
			} else {
				if (result.type == type) console.log(line, time, offset, len, result.__type_info);
			}
		} catch (e: any) {
			console.error(line, e.message);
			if (e.message.search('Unexpected message length') < 0) {
				console.log('Message', message.toString('hex'));
				return;
			}
		}
		offset += len + 7;
	}
}

// export function fileVerifyIntegrity(data: Buffer) {
// 	const size = data.byteLength;
// 	const offset = size - 40;

// 	const type = data.readUInt8(offset + 7);
// 	const to_verify = data.subarray(0, offset);
// 	const checksum = data.subarray(offset + 8, offset + 40);
// 	if (type != 0x40 || data.readUInt16BE(offset + 5) != 33) throw new Error('Checksum not preset');
// 	const result = createHash('sha256').update(to_verify).digest();

// }
