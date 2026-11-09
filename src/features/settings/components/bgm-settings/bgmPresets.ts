import { Sparkles, Piano, Waves, CloudRain } from 'lucide-react';

export const PRESET_MUSIC_LIST = [
	{
		id: 'synth',
		name: 'Synth Ambient',
		icon: Sparkles,
		url: '/audio/ambient-bgm.mp3',
	},
	{
		id: 'lofi',
		name: 'Lofi Piano',
		icon: Piano,
		url: '/audio/lofi-piano.mp3',
	},
	{
		id: 'ocean',
		name: 'Sóng Biển',
		icon: Waves,
		url: '/audio/ocean-waves.mp3',
	},
	{
		id: 'rain',
		name: 'Mưa Rơi',
		icon: CloudRain,
		url: '/audio/gentle-rain.mp3',
	},
];
