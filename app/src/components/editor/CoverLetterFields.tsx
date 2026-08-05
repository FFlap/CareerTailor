import { FieldRow, ItemBlock, Section, controlClass } from "./primitives";
import type { Disclosure } from "./ResumeFields";
import { moveItem, removeAt, replaceAt, type CoverLetterData } from "./model";
import { useDragReorder } from "./useDragReorder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const wordCount = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

export function CoverLetterFields({
  value,
  onChange,
  disclosure,
}: {
  value: CoverLetterData;
  onChange: (next: CoverLetterData) => void;
  disclosure: Disclosure;
}) {
  const update = (patch: Partial<CoverLetterData>) =>
    onChange({ ...value, ...patch });

  const paragraphs = value.body_paragraphs;

  const drag = useDragReorder({
    listId: "paragraphs",
    onMove: (from, to) =>
      update({ body_paragraphs: moveItem(paragraphs, from, to) }),
  });

  const addParagraph = () => {
    update({ body_paragraphs: [...paragraphs, ""] });
    disclosure.set("body", true);
    disclosure.set(`body:${paragraphs.length}`, true);
  };

  return (
    <>
      <Section
        title="Greeting"
        preview={value.greeting}
        open={disclosure.isOpen("greeting")}
        onToggle={() => disclosure.toggle("greeting")}
      >
        <Input
          value={value.greeting}
          onChange={(e) => update({ greeting: e.target.value })}
          placeholder="Dear Hiring Manager,"
          className={controlClass}
          aria-label="Greeting"
        />
      </Section>

      <Section
        title="Body"
        count={paragraphs.length}
        preview={`${paragraphs.reduce((total, item) => total + wordCount(item), 0)} words`}
        open={disclosure.isOpen("body")}
        onToggle={() => disclosure.toggle("body")}
        onAdd={addParagraph}
        addLabel="Add paragraph"
      >
        {paragraphs.map((paragraph, index) => (
          <ItemBlock
            key={index}
            index={index}
            title={paragraph.trim().slice(0, 48) || "Empty paragraph"}
            preview={`${wordCount(paragraph)} words`}
            open={disclosure.isOpen(`body:${index}`)}
            onToggle={() => disclosure.toggle(`body:${index}`)}
            onRemove={() => {
              const next = removeAt(paragraphs, index);
              update({ body_paragraphs: next.length ? next : [""] });
            }}
            removeLabel="Remove paragraph"
            handle={drag.dragProps(
              index,
              `paragraph ${index + 1}`,
              paragraphs.length,
            )}
            row={drag.dropProps(index)}
            edge={drag.dropEdge(index)}
            dragging={drag.dragging === index}
          >
            <Textarea
              value={paragraph}
              onChange={(e) =>
                update({
                  body_paragraphs: replaceAt(paragraphs, index, e.target.value),
                })
              }
              rows={4}
              aria-label={`Paragraph ${index + 1}`}
              className={cn(
                controlClass,
                "h-auto min-h-[5.5rem] py-1.5 leading-relaxed",
              )}
            />
          </ItemBlock>
        ))}
      </Section>

      <Section
        title="Sign-off"
        preview={[value.closing, value.signature_name]
          .filter(Boolean)
          .join(" · ")}
        open={disclosure.isOpen("signoff")}
        onToggle={() => disclosure.toggle("signoff")}
      >
        <FieldRow label="Closing" htmlFor="f-closing">
          <Input
            id="f-closing"
            value={value.closing}
            onChange={(e) => update({ closing: e.target.value })}
            placeholder="Sincerely,"
            className={controlClass}
          />
        </FieldRow>
        <FieldRow label="Name" htmlFor="f-signature">
          <Input
            id="f-signature"
            value={value.signature_name}
            onChange={(e) => update({ signature_name: e.target.value })}
            className={controlClass}
          />
        </FieldRow>
      </Section>
    </>
  );
}
