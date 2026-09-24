/** The rules in a few short sections, with the real pieces drawn alongside. */

import { motion } from 'framer-motion';
import { TreasureChip, BlankChip } from './art/Chip';
import { Die } from './art/Die';
import { Diver } from './art/Diver';
import { LEVELS } from '../lib/theme';

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-abyss/80 px-3 py-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="paper scrollbar-thin relative max-h-full w-full max-w-lg overflow-y-auto rounded-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-ink-soft hover:bg-sand-2"
          aria-label="Đóng"
        >
          ✕
        </button>
        <h2 className="display text-2xl font-extrabold text-ink">Luật chơi</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Các thợ lặn nghèo thuê chung một chiếc tàu ngầm và dùng chung <b className="text-ink">một bình khí</b>. Lặn
          càng sâu kho báu càng quý — nhưng ai không về tàu kịp trước khi hết khí sẽ phải bỏ lại toàn bộ kho báu đang
          mang.
        </p>

        <Section title="Kho báu">
          <div className="grid grid-cols-4 gap-2 text-center">
            {([1, 2, 3, 4] as const).map((lv) => (
              <div key={lv} className="flex flex-col items-center rounded-xl bg-white/60 py-2">
                <TreasureChip level={lv} size={38} />
                <div className="display mt-1 text-xs font-bold text-ink">Cấp {lv}</div>
                <div className="text-[11px] text-ink-soft">{LEVELS[lv].range} điểm</div>
              </div>
            ))}
          </div>
          <p className="mt-2">
            Kho báu úp mặt, chỉ biết cấp (hình dạng và số chấm). Giá trị chỉ lộ ra khi bạn mang được về tàu.
          </p>
        </Section>

        <Section title="Mỗi lượt">
          <ol className="space-y-2">
            <Step n={1} title="Thở">
              Không khí giảm bằng <b>số kho báu bạn đang mang</b>. Tay không thì không tốn khí.
            </Step>
            <Step n={2} title="Quay đầu (tuỳ chọn)">
              Quyết định quay về tàu. Mỗi lượt lặn chỉ quay đầu được <b>một lần</b>.
            </Step>
            <Step n={3} title="Bơi">
              <span className="float-right ml-2 flex gap-1">
                <Die value={2} size={26} />
                <Die value={3} size={26} />
              </span>
              Tung 2 xúc xắc (mỗi mặt 1–3), <b>trừ đi số kho báu đang mang</b>, rồi bơi chừng ấy ô. Ô có thợ lặn khác
              thì nhảy qua, không tính.
            </Step>
            <Step n={4} title="Kho báu">
              <span className="float-right ml-2">
                <BlankChip size={30} />
              </span>
              Nhặt kho báu ở ô đang đứng (để lại ô trống), <b>hoặc</b> thả một kho báu xuống ô trống, <b>hoặc</b> không
              làm gì.
            </Step>
          </ol>
        </Section>

        <Section title="Hết lượt lặn">
          <div className="float-right ml-3 flex gap-0.5">
            <Diver color={1} size={26} />
            <div className="rotate-[168deg]">
              <Diver color={0} size={26} />
            </div>
          </div>
          <p>
            Lượt lặn kết thúc khi mọi người đã về tàu, hoặc khi không khí về 0 (người làm cạn bình vẫn đi nốt lượt).
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>Ai đã về tàu: lật kho báu lên và giữ làm điểm.</li>
            <li>
              Ai chưa về: đánh rơi hết kho báu. Chúng chìm xuống cuối đường lặn thành <b>chồng 3 chiếc</b> — một chồng
              tính như một kho báu.
            </li>
            <li>Các ô trống bị bỏ đi, đường lặn ngắn lại. Người về tàu cuối cùng đi trước ở lượt lặn sau.</li>
          </ul>
        </Section>

        <Section title="Thắng cuộc">
          Sau <b>3 lượt lặn</b>, ai nhiều điểm nhất thắng. Bằng điểm thì ai có nhiều kho báu cấp cao hơn thắng.
        </Section>

        <p className="mt-4 text-[11px] leading-relaxed text-ink-soft/80">
          Deep Sea Adventure do Jun Sasaki & Goro Sasaki thiết kế, Oink Games phát hành. Đây là bản dựng lại phi thương
          mại để chơi cùng bạn bè.
        </p>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 text-sm leading-relaxed text-ink-soft">
      <h3 className="display mb-1.5 text-base font-extrabold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="display flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sea text-xs font-extrabold text-sand">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <b className="text-ink">{title}.</b> {children}
      </div>
    </li>
  );
}
