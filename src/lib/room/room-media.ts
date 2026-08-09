/**
 * ============================================================
 * 原石航路 Studio
 * 声 — WebRTC
 *
 * 部屋にいる人どうしを直に繋いで、声を送る。
 *
 * ------------------------------------------------------------
 * 仕組み
 *
 * 端末どうしを直に繋ぐには、まず「どこへ繋げばいいか」を
 * 教え合う必要がある。その受け渡しだけを、
 * すでに開いている通り道（Presence）に乗せる。
 *
 * 通り道そのものは受け取らない。送る口と受け取る口だけをもらう。
 * チャンネルを直に受け取ると、購読が始まったあとに
 * listener を足すことになって落ちる。
 *
 *   1. 先にいる人へ「繋ぎたい」と申し出る
 *   2. 相手が返す
 *   3. 経路の候補を送り合う
 *   4. 繋がったら、あとは端末どうしで直接やり取りする
 *
 * 部屋の人数ぶんだけ 1 対 1 の線を張る（全結線）。
 * 5 人なら 1 人あたり 4 本。
 * 20 人だと 19 本になって重くなるが、
 * 中継サーバーを立てるより先に、まず動く形を作る。
 *
 * ------------------------------------------------------------
 * 繋ぐ向きの決め方
 *
 * 両方が同時に申し出ると、線が二重に張られる。
 * id を比べて、小さいほうから申し出る、と決めておく。
 * 相手より先に入ったかどうかでは決められない。
 * 入った順は端末ごとに違って見えることがある。
 * ============================================================
 */

/** 経路を探すための公共のサーバー。自前で立てるまではこれを使う */
const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * 合図の通り道。
 *
 * Presence が持っているものをそのまま使う。
 * ここでは「送れること」と「受け取れること」しか要らない。
 */
export interface MediaTransport {
    sendMedia(payload: unknown): void;
    onMedia(handler: (payload: unknown) => void): () => void;
}

/** 相手ごとの繋がり */
interface Peer {
    connection: RTCPeerConnection;
    /** 相手から届いた声や画面 */
    stream: MediaStream;
}

export interface MediaState {
    /** マイクを入れているか */
    isMicOn: boolean;
    /** いま繋がっている相手（自分は含まない） */
    remoteIds: string[];
}

/** やり取りする合図 */
type Signal =
    | { kind: "offer"; from: string; to: string; sdp: string }
    | { kind: "answer"; from: string; to: string; sdp: string }
    | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

export class RoomMedia {
    private peers = new Map<string, Peer>();
    private micStream: MediaStream | null = null;
    private handlers = new Set<(state: MediaState) => void>();

    /** 受け取りをやめるための控え */
    private stopListening: () => void;

    constructor(
        private selfId: string,
        private transport: MediaTransport,
    ) {
        this.stopListening = transport.onMedia((payload) => {
            void this.receive(payload as Signal);
        });
    }

    subscribe(handler: (state: MediaState) => void): () => void {
        this.handlers.add(handler);
        handler(this.snapshot());
        return () => this.handlers.delete(handler);
    }

    /** 相手の声や画面を再生するための束を返す */
    streamOf(memberId: string): MediaStream | null {
        return this.peers.get(memberId)?.stream ?? null;
    }

    /**
     * ==========================================================
     * マイク
     * ==========================================================
     */

    async toggleMic(): Promise<void> {
        if (this.micStream) {
            /*
             * 止めるときは束ごと閉じる。
             * 音を無効にするだけだと、端末の「使用中」の印が消えず、
             * 切ったつもりの人が切れていないと感じる。
             */
            for (const track of this.micStream.getTracks()) track.stop();
            this.micStream = null;
            this.emit();
            return;
        }

        this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
            },
        });

        /*
         * すでに繋いでいる相手に、音を乗せる。
         *
         * 乗せただけでは相手に届かない。
         * 「送るものが増えた」と申し出直す必要がある。
         *
         * これをしていなかったので、繋がっているのに
         * 中身が空のまま届いていた。
         */
        for (const [id, peer] of Array.from(this.peers)) {
            for (const track of this.micStream.getTracks()) {
                peer.connection.addTrack(track, this.micStream);
            }

            /*
             * 申し出は negotiationneeded に任せる。
             * ここで重ねると、二重に申し出ることになる。
             */
        }

        this.emit();
    }

    /**
     * ==========================================================
     * 繋ぎ直し
     *
     * 在室者が変わるたびに呼ぶ。
     * いなくなった人との線を閉じ、増えた人へ申し出る。
     * ==========================================================
     */

    sync(memberIds: string[]): void {
        const others = memberIds.filter((id) => id !== this.selfId);

        /* いなくなった人 */
        for (const [id, peer] of Array.from(this.peers)) {
            if (others.includes(id)) continue;
            peer.connection.close();
            this.peers.delete(id);
        }

        /*
         * 増えた人。
         *
         * 申し出るのは id が小さいほうだけ。
         * 両方が申し出ると、返事を受け取る番が来ない。
         */
        for (const id of others) {
            if (this.peers.has(id)) continue;

            this.ensurePeer(id);
            if (this.selfId < id) void this.offer(id);
        }

        this.emit();
    }

    dispose(): void {
        for (const [, peer] of Array.from(this.peers)) peer.connection.close();
        this.peers.clear();

        if (this.micStream) {
            for (const track of this.micStream.getTracks()) track.stop();
        }
        this.micStream = null;
        this.handlers.clear();
        this.stopListening();
    }

    /**
     * ==========================================================
     * 内部
     * ==========================================================
     */

    private ensurePeer(id: string): Peer {
        const found = this.peers.get(id);
        if (found) return found;

        const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const stream = new MediaStream();
        const peer: Peer = { connection, stream };
        this.peers.set(id, peer);

        /* いま出している声を、繋いだ相手にも送る */
        if (this.micStream) {
            for (const track of this.micStream.getTracks()) {
                connection.addTrack(track, this.micStream);
            }
        }

        connection.addEventListener("track", (event) => {
            stream.addTrack(event.track);
            this.emit();
        });

        connection.addEventListener("icecandidate", (event) => {
            if (!event.candidate) return;
            this.post({
                kind: "ice",
                from: this.selfId,
                to: id,
                candidate: event.candidate.toJSON(),
            });
        });

        connection.addEventListener("connectionstatechange", () => {
            if (
                connection.connectionState === "failed" ||
                connection.connectionState === "closed"
            ) {
                this.peers.delete(id);
                this.emit();
            }
        });

        /*
         * 送るものが増えたら、繋ぎ直しの申し出をやり直す。
         * マイクを後から入れたとき、これが無いと相手に届かない。
         *
         * id の小さいほうに限らない。
         * 音を足したのは自分なので、自分から申し出る。
         * 相手はマイクを入れていないかもしれない。
         *
         * 同時に申し出てぶつかったら、受け取る側で譲る。
         */
        connection.addEventListener("negotiationneeded", () => {
            if (connection.signalingState !== "stable") return;
            void this.offer(id);
        });

        return peer;
    }

    private async offer(id: string): Promise<void> {
        const peer = this.ensurePeer(id);
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);

        this.post({
            kind: "offer",
            from: this.selfId,
            to: id,
            sdp: offer.sdp ?? "",
        });
    }

    private async receive(signal: Signal): Promise<void> {
        /* 自分宛て以外は捨てる */
        if (signal.to !== this.selfId) return;

        const peer = this.ensurePeer(signal.from);

        if (signal.kind === "offer") {
            /*
             * 申し出を受ける。
             *
             * 自分も同時に申し出ていることがある。
             * そのままでは双方が待つ側になれず、どちらも繋がらない。
             *
             * id の小さいほうを通す。
             * 大きいほうは、自分の申し出を取り下げてから受ける。
             */
            const isColliding =
                peer.connection.signalingState === "have-local-offer";

            if (isColliding) {
                if (this.selfId < signal.from) {
                    /* 自分が通る側。相手の申し出は捨てる */
                    return;
                }

                /* 自分が譲る側。申し出を取り下げる */
                await peer.connection.setLocalDescription({
                    type: "rollback",
                });
            }

            await peer.connection.setRemoteDescription({
                type: "offer",
                sdp: signal.sdp,
            });
            const answer = await peer.connection.createAnswer();
            await peer.connection.setLocalDescription(answer);

            this.post({
                kind: "answer",
                from: this.selfId,
                to: signal.from,
                sdp: answer.sdp ?? "",
            });
            return;
        }

        if (signal.kind === "answer") {
            /*
             * 返事を受け取る。
             *
             * 自分が申し出た直後（have-local-offer）でなければ、
             * その返事はもう済んでいる。
             *
             * 同じ返事が 2 度届くことがある。
             * 2 度目をそのまま入れると
             * 「Called in wrong state: stable」で落ちる。
             */
            if (peer.connection.signalingState !== "have-local-offer") return;

            await peer.connection.setRemoteDescription({
                type: "answer",
                sdp: signal.sdp,
            });
            return;
        }

        /*
         * 経路の候補。
         * 相手の情報が届く前に来ることがあるので、失敗しても止めない。
         */
        try {
            await peer.connection.addIceCandidate(signal.candidate);
        } catch {
            /* 順序の行き違い。次の候補で繋がる */
        }
    }

    private post(signal: Signal): void {
        this.transport.sendMedia(signal);
    }

    private snapshot(): MediaState {
        return {
            isMicOn: this.micStream !== null,
            remoteIds: Array.from(this.peers.keys()),
        };
    }

    private emit(): void {
        const state = this.snapshot();
        for (const handler of Array.from(this.handlers)) handler(state);
    }
}
