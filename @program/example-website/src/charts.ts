import { CategoryScale, Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

interface IOptions {
	/**
	 * 每秒多少个数据（采样率）
	 */
	frameRate: number;
	/**
	 * 持续时间（秒）（现在固定为10秒）
	 */
	duration: number;
	/**
	 * x 轴刻度间隔（秒），例如 1 表示每秒一个刻度，0.5 表示每半秒一个刻度
	 */
	xAxisTickSeconds?: number;
	/**
	 * 类型
	 *  fill - 直线下方填充颜色
	 *  line - 只有线条，不填充
	 */
	kind: 'fill' | 'line';
	/**
	 * 线条颜色
	 */
	lineColor: string;
}

export class ChannelChart {
	private readonly canvas: HTMLCanvasElement;
	private readonly chart: Chart<'line', Int32Array, number>;
	private readonly frameCount: number;
	// private readonly frameRate: number;
	private readonly xAxisTickSeconds: number;

	constructor(canvasId: string, options: IOptions) {
		const canvas = document.getElementById(canvasId);
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error(`未找到画布元素：${canvasId}`);
		}

		if (options.frameRate <= 0) {
			throw new Error('采样率必须大于 0');
		}

		this.xAxisTickSeconds = options.xAxisTickSeconds ?? 1;
		if (this.xAxisTickSeconds <= 0) {
			throw new Error('x 轴刻度间隔必须大于 0');
		}

		this.canvas = canvas;
		// this.frameRate = options.frameRate;
		this.frameCount = Math.floor(options.frameRate * options.duration);

		const step = options.duration / this.frameCount;
		const xLabels = new Array(this.frameCount).fill(0).map((_, i) => {
			// 返回距离结束还有多少秒，保留一位小数
			return `${(options.duration - i * step).toFixed(step < 1 ? 1 : 0)}s`;
		});

		this.chart = new Chart(this.canvas, {
			type: 'line',
			data: {
				labels: xLabels as any,
				datasets: [
					{
						label: '数据',
						data: new Int32Array(this.frameCount),
						borderColor: options.lineColor,
						backgroundColor: options.kind === 'fill' ? `${options.lineColor}26` : 'transparent',
						borderWidth: 1,
						pointRadius: 0,
						fill: options.kind === 'fill',
						tension: 0.2,
					},
				],
			},
			options: {
				// parsing: false,
				normalized: true,
				animation: false,
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						type: 'category',
						// min: 0,
						// max: this.frameCount,
						// ticks: {
						// 	stepSize: this.xAxisTickSeconds,
						// 	callback: (value) => {
						// 		return `${(options.duration - Number(value)).toFixed(this.xAxisTickSeconds < 1 ? 1 : 0)}s`;
						// 	},
						// },
						grid: {
							color: '#ffffff14',
						},
						title: {
							display: true,
							text: '时间（秒）',
						},
					},
					y: {
						grid: {
							color: '#ffffff14',
						},
						ticks: {
							maxTicksLimit: 6,
						},
					},
				},
				plugins: {
					legend: {
						display: false,
					},
				},
			},
		});
	}

	update(data: Int32Array): void {
		// assume data is exactly frameCount length
		this.chart.data.datasets[0].data = data;
	}

	render() {
		this.chart.update('none');
	}
}
