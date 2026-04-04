import { decodeBinaryFrame } from '@core/protocol/browser';
import { CategoryScale, Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import { ChannelChart } from './charts.js';
import { ChannelBuffer } from './ring-buffer.js';

const DURATION_SECONDS = 10;

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const buffers: ChannelBuffer[] = [];
const charts: ChannelChart[] = [];

// ─── 节流渲染（接收不限速，渲染 500ms 节流）────────────────────────────────
function flushAll(): void {
	for (const chart of charts) {
		chart.render();
	}
	writeStats();
}
setInterval(flushAll, 100);

// ─── 统计信息显示 ────────────────────────────────────────────────────────
const statsDiv = document.getElementById('stats') as HTMLDivElement;
function writeStats() {
	const statArr = Object.entries(counter).map(([key, value]) => `stream ${key}: ${value}`);

	for (const i of counter.keys()) {
		statArr.push(`  buffer ${i}: ${buffers[i].debug()}`);
	}

	statArr.push(`WebSocket: ${socket.readyState}`);

	statsDiv.innerText = statArr.join('\n');
}

// ─── WebSocket ─────────────────────────────────────────────────────────
const websocketPath = `/ws/2f4e73a4-5c74-4dab-bb6a-6cc8a8f9eeb1`;
const u = new URL(websocketPath, location.href);
u.protocol = u.protocol.replace('http', 'ws');
const socket = new WebSocket(u);
socket.binaryType = 'arraybuffer';

socket.onopen = () => {
	console.log('WebSocket connection opened');
};

const counter: number[] = [];

socket.onmessage = (event) => {
	const data = new Uint8Array(event.data);
	const frame = decodeBinaryFrame(data);

	if (frame.func < 0 || frame.func > 2) {
		console.log('unknown frame:', frame.func);
		return;
	}
	if (!buffers[frame.func]) {
		console.log(`init channel ${frame.func} with rate ${frame.rate}`);
		buffers[frame.func] = new ChannelBuffer(frame.rate * DURATION_SECONDS);
		charts[frame.func] = new ChannelChart(`chart${frame.func}`, {
			frameRate: frame.rate,
			duration: DURATION_SECONDS,
			lineColor: ['#ff6384', '#36a2eb', '#cc65fe'][frame.func],
			kind: (['line', 'fill', 'line'] as const)[frame.func],
		});
		counter[frame.func] = 0;
	}

	buffers[frame.func].push(frame.content as Int32Array);
	charts[frame.func].update(buffers[frame.func].getCurrentBuffer());
	counter[frame.func]++;
};

socket.onclose = () => {
	console.error('WebSocket connection closed');
};

socket.onerror = (error) => {
	console.error('WebSocket error:', error);
};
