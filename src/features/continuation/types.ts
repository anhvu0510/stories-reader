export type BranchMode = 'MAIN' | 'SPINOFF' | 'WHAT_IF';

export interface EntityRecord {
	name: string;
	status: 'ALIVE' | 'DEAD' | 'MISSING' | 'SEALED';
	powerLevel?: string;
	location?: string;
	inventory?: string[];
	knownSecrets?: string[];
}

export interface PlotThreadRecord {
	threadId: string;
	title: string;
	category: string;
	status: 'ACTIVE' | 'RESOLVED' | 'DORMANT' | 'ABANDONED';
	openQuestion: string;
	potentialDirections?: string[];
}

export interface StyleFingerprintRecord {
	voice: string;
	pacing: string;
	sensoryTone?: string;
	cliffhangerState?: string;
	pronounRules?: string[];
	styleExemplars?: string[];
	antiSlopRules?: string[];
}

export interface StoryStateRecord {
	bookId: string;
	bookName: string;
	lastIngestedChapter: number;
	entities: EntityRecord[];
	worldRules: string[];
	plotThreads: PlotThreadRecord[];
	arcCheckpoints: Array<{
		chapterNumber: number;
		entitiesSnapshot: EntityRecord[];
		plotThreadsSnapshot: PlotThreadRecord[];
	}>;
	styleFingerprint: StyleFingerprintRecord;
	verbatimTail: string;
}

export interface AutopilotStatusRecord {
	status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED' | 'ERROR';
	targetCount: number;
	completedCount: number;
	currentChapterNumber: number;
	currentStep: string;
	startedAt?: string;
	completedAt?: string;
	error?: string;
}

export interface StoryBranchRecord {
	branchId: string;
	sourceBookId: string;
	title: string;
	mode: BranchMode;
	forkAtChapter: number;
	targetThreadId?: string;
	counterfactualPremise?: string;
	lastWrittenChapter: number;
	status: 'ACTIVE' | 'MERGED' | 'ABANDONED';
	arcPlan?: {
		branchTitle: string;
		endgameGoal: string;
		arcSummary: string;
		chapters: Array<{
			chapterNumber: number;
			title: string;
			summary: string;
			payoffType?: string;
		}>;
	};
	autopilot?: AutopilotStatusRecord;
}

export interface StudioHubResponse {
	book: {
		bookId: string;
		bookName: string;
		author?: string;
		chapterCount?: number;
		totalChapters?: number;
		summary?: string;
	};
	storyState: StoryStateRecord | null;
	branches: StoryBranchRecord[];
	currentBranch: StoryBranchRecord | null;
}
