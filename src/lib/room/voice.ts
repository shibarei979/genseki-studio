/**
 * ============================================================
 * 原石航路 Studio
 * 声をつなぐ
 *
 * P2P（互いに直につなぐ）。中継のサーバーを使わない。
 *
 * そのぶん、話す人が増えるほど繋ぎが増える。
 *   4 人 … 6 本
 *   10 人 … 45 本
 * 回線が持たないので、話す人は 4 人までにしてある。
 * 聞くだけの人は繋がないので、何人いても構わない。
 *
 * 合図のやり取りには Supabase Realtime を使う。
 * 声そのものは通らない。相手を見つけるためだけに使う。
 * ============================================================
 */

import type { RealtimeChannel } from "@supabase/supabase-js";

/** 同時に話せる人数 */
export const MAX_SPEAKERS = 4;

/**
 * 話していると判断する大きさ。
 *
 * 始めと終わりで段差をつける。
 * 同じ値にすると、境目で光が細かく点滅する。
 */
const START_LEVEL = 14;
const STOP_LEVEL = 8;

/**
 * 相手を見つけるための道しるべ。
 *
 * 無料のものを使う。自前で建てる必要はない。
 * これが無いと、別の回線どうしで繋がらない。
 */
const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

export interface VoiceMember {
    id: string;
    /** 声が届いているか */
    isConnected: boolean;
    /** いま話しているか */
    isSpeaking: boolean;
}

export interface VoiceState {
    /** 自分のマイクが入っているか */
    isMicOn: boolean;
    /** 用意ができているか */
    isReady: boolean;
    /** 繋がっている相手 */
    members: VoiceMember[];
    error: string;
}

type Signal =
    | { kind: "offer"; from: string; to: string; sdp: string }
    | { kind: "answer"; from: string; to: string; sdp: string }
    | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
    | { kind: "join"; from: string }
    | { kind: "leave"; from: string };

/**
 * ============================================================
 * 本体
 * ============================================================
 */

export class VoiceRoom {
    private peers = new Map<string, RTCPeerConnection>();
    private audios = new Map<string, HTMLAudioElement>();
    private stream: MediaStream | null = null;

    private handlers = new Set<(state: VoiceState) => void>();
    private state: VoiceState = {
        isMicOn: false,
        isReady: false,
        members: [],
        error: "",
    };

    /** 声の大きさを見る道具。話しているかどうかを出す */
    private analyser: AnalyserNode | null = null;
    private levelTimer: number | null = null;

    constructor(
        private selfId: string,
        private channel: RealtimeChannel,
    ) {
        this.channel.on("broadcast", { event: "voice" }, ({ payload }) => {
            void this.receive(payload as Signal);
        });
    }

    subscribe(handler: (state: VoiceState) => void): () => void {
        this.handlers.add(handler);
        handler(this.state);
        return () => this.handlers.delete(handler);
    }

    /**
     * マイクを入れる。
     *
     * 許可を求めるのはここが初めて。
     * 部屋に入った瞬間に聞かれると、身構えさせてしまう。
     */
    async start(): Promise<void> {
        if (this.stream) return;

        this.update({ error: "" });

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    // 声以外を抑える。書く場なので、打鍵音が乗ると煩い
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
        } catch (caught) {
            this.update({
                error:
                    caught instanceof DOMException &&
                    caught.name === "NotAllowedError"
                        ? "マイクの使用が許可されていません。ブラウザの設定を確かめてください。"
                        : "マイクを使えませんでした。",
            });
            return;
        }

        this.watchLevel();
        this.update({ isMicOn: true, isReady: true });

        // ほかの話す人に知らせる。受け取った側から繋ぎに来る
        this.send({ kind: "join", from: this.selfId });
    }

    /** マイクを切る。繋ぎも全部たたむ */
    stop(): void {
        this.send({ kind: "leave", from: this.selfId });

        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;

        this.peers.forEach((peer) => peer.close());
        this.peers.clear();

        this.audios.forEach((audio) => {
            audio.pause();
            audio.srcObject = null;
        });
        this.audios.clear();

        if (this.levelTimer !== null) window.clearInterval(this.levelTimer);
        this.levelTimer = null;
        this.analyser = null;

        // 切った瞬間に光を消す。残ると、まだ喋っているように見える
        this.update({ isMicOn: false, members: [] });
    }

    dispose(): void {
        this.stop();
        this.handlers.clear();
    }

    /**
     * ==========================================================
     * 合図のやり取り
     * ==========================================================
     */

    private send(signal: Signal): void {
        void this.channel.send({
            type: "broadcast",
            event: "voice",
            payload: signal,
        });
    }

    private async receive(signal: Signal): Promise<void> {
        // 自分の合図は無視する
        if (signal.from === this.selfId) return;
        // 宛先があるなら、自分宛てだけ
        if ("to" in signal && signal.to !== this.selfId) return;

        // マイクを入れていない人は繋がない
        if (!this.stream) return;

        if (signal.kind === "join") {
            /*
             * 後から入った人へ、こちらから声をかける。
             * 双方が同時にかけると繋ぎが二重になるので、
             * id の大小で片方だけがかけるようにする。
             */
            if (this.selfId > signal.from) await this.callTo(signal.from);
            return;
        }

        if (signal.kind === "leave") {
            this.closePeer(signal.from);
            return;
        }

        const peer = this.peers.get(signal.from) ?? this.createPeer(signal.from);

        if (signal.kind === "offer") {
            await peer.setRemoteDescription({ type: "offer", sdp: signal.sdp });
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            this.send({
                kind: "answer",
                from: this.selfId,
                to: signal.from,
                sdp: answer.sdp ?? "",
            });
            return;
        }

        if (signal.kind === "answer") {
            await peer.setRemoteDescription({ type: "answer", sdp: signal.sdp });
            return;
        }

        if (signal.kind === "ice") {
            try {
                await peer.addIceCandidate(signal.candidate);
            } catch {
                // 順番が前後すると失敗する。捨ててよい
            }
        }
    }

    private async callTo(peerId: string): Promise<void> {
        const peer = this.createPeer(peerId);

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        this.send({
            kind: "offer",
            from: this.selfId,
            to: peerId,
            sdp: offer.sdp ?? "",
        });
    }

    private createPeer(peerId: string): RTCPeerConnection {
        const existing = this.peers.get(peerId);
        if (existing) return existing;

        const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // 自分の声を送る
        this.stream?.getTracks().forEach((track) => {
            peer.addTrack(track, this.stream as MediaStream);
        });

        // 相手の声を受け取る
        peer.ontrack = (event) => {
            const audio = this.audios.get(peerId) ?? new Audio();
            audio.srcObject = event.streams[0];
            audio.autoplay = true;
            void audio.play().catch(() => {
                /*
                 * 画面を触る前は鳴らせないことがある。
                 * マイクを入れたあとなら、ふつうは通る。
                 */
            });
            this.audios.set(peerId, audio);
            this.refreshMembers();
        };

        peer.onicecandidate = (event) => {
            if (!event.candidate) return;
            this.send({
                kind: "ice",
                from: this.selfId,
                to: peerId,
                candidate: event.candidate.toJSON(),
            });
        };

        peer.onconnectionstatechange = () => {
            if (
                peer.connectionState === "failed" ||
                peer.connectionState === "closed"
            ) {
                this.closePeer(peerId);
            }
            this.refreshMembers();
        };

        this.peers.set(peerId, peer);
        return peer;
    }

    private closePeer(peerId: string): void {
        this.peers.get(peerId)?.close();
        this.peers.delete(peerId);

        const audio = this.audios.get(peerId);
        if (audio) {
            audio.pause();
            audio.srcObject = null;
        }
        this.audios.delete(peerId);

        this.refreshMembers();
    }

    /**
     * ==========================================================
     * 話しているかどうか
     * ==========================================================
     */

    private watchLevel(): void {
        if (!this.stream) return;

        const context = new AudioContext();
        const source = context.createMediaStreamSource(this.stream);

        this.analyser = context.createAnalyser();
        /*
         * 細かく見る必要はない。
         * 小さくすると、1 回あたりの計算も待ち時間も減る。
         */
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.2;
        source.connect(this.analyser);

        const buffer = new Uint8Array(this.analyser.frequencyBinCount);

        /* いま話しているとみなしているか */
        let speaking = false;
        /* 静かになってからの回数 */
        let quietCount = 0;

        this.levelTimer = window.setInterval(() => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(buffer);

            let sum = 0;
            for (let i = 0; i < buffer.length; i += 1) sum += buffer[i];
            const level = sum / buffer.length;

            if (level > START_LEVEL) {
                /* 声が出たら、すぐ光らせる */
                quietCount = 0;
                if (!speaking) {
                    speaking = true;
                    this.setSelfSpeaking(true);
                }
                return;
            }

            if (!speaking) return;

            /*
             * 静かになっても、すぐには消さない。
             *
             * 話の切れ目で一瞬途切れるたびに消えると、
             * 光がちらついて落ち着かない。
             *
             * ただし待ちすぎると、話し終えたあとも光り続ける。
             * 3 回（約 240ミリ秒）で消す。
             */
            if (level > STOP_LEVEL) {
                quietCount = 0;
                return;
            }

            quietCount += 1;
            if (quietCount >= 3) {
                speaking = false;
                quietCount = 0;
                this.setSelfSpeaking(false);
            }
        }, 80);
    }

    /** 自分が話しているかどうかを差し替える */
    private setSelfSpeaking(isSpeaking: boolean): void {
        const members = this.state.members.map((row) =>
            row.id === this.selfId ? { ...row, isSpeaking } : row,
        );

        // まだ一覧に自分がいなければ、作ってから入れる
        if (!members.some((row) => row.id === this.selfId)) {
            members.unshift({
                id: this.selfId,
                isConnected: this.stream !== null,
                isSpeaking,
            });
        }

        this.update({ members });
    }

    private refreshMembers(): void {
        const members: VoiceMember[] = [
            {
                id: this.selfId,
                isConnected: this.stream !== null,
                // 話しているかどうかは watchLevel が持っている
                isSpeaking:
                    this.state.members.find((row) => row.id === this.selfId)
                        ?.isSpeaking ?? false,
            },
        ];

        this.peers.forEach((peer, id) => {
            members.push({
                id,
                isConnected: peer.connectionState === "connected",
                isSpeaking: false,
            });
        });

        this.update({ members });
    }

    private update(patch: Partial<VoiceState>): void {
        this.state = { ...this.state, ...patch };
        this.handlers.forEach((handler) => handler(this.state));
    }
}
