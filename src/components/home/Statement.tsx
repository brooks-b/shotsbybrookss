import { site } from "@/lib/site";
import { Reveal } from "../motion/Reveal";

export function Statement() {
  return (
    <section aria-label="Statement" className="gutter grid gap-8 py-[clamp(120px,22vh,240px)] md:grid-cols-12">
      <p className="micro text-paper-faint md:col-span-3">{site.arc}</p>
      <Reveal as="div" variant="lines" className="md:col-span-8 lg:col-span-7">
        <p className="line-mask font-display text-[clamp(26px,3.1vw,46px)] leading-[1.18] tracking-[-0.025em]">
          <span>{site.statement}</span>
        </p>
      </Reveal>
    </section>
  );
}
