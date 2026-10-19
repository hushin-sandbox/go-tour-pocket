import { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LicenseEntry, LicensesData } from '@/shared/licenses';

/** URL を表示用の短いラベル（ホスト名）にする。 */
function linkLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** `github.com/traefik/yaegi` のような長い名前を `/` の後で折り返せるようにする。 */
function PackageName({ name }: { name: string }) {
  const segments = name.split('/');
  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <>
              /<wbr />
            </>
          )}
          {segment}
        </Fragment>
      ))}
    </>
  );
}

function LicenseText({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-foreground/90">
        {text}
      </pre>
    </div>
  );
}

function LicenseDetails({ entry }: { entry: LicenseEntry }) {
  return (
    <details className="group rounded-xl border border-border bg-card px-4 py-1">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-1 gap-y-0.5 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 break-words">
          {entry.name}
          {entry.version !== null ? ` ${entry.version}` : ''}
        </span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">
          · {entry.license}
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-1 mb-2 flex flex-col gap-3">
        {entry.note !== null && (
          <p className="text-xs leading-5 text-muted-foreground text-pretty">{entry.note}</p>
        )}
        {entry.author !== null && (
          <p className="text-xs leading-5 text-muted-foreground">著作者: {entry.author}</p>
        )}
        {entry.text !== null && <LicenseText label={`${entry.license} の全文`} text={entry.text} />}
        {entry.extras.map((extra) => (
          <LicenseText key={extra.label} label={extra.label} text={extra.text} />
        ))}
      </div>
    </details>
  );
}

/** 上に要約の表、下にライセンス全文を折りたたみで並べる。 */
export function LicensesPage({ data }: { data: LicensesData }) {
  return (
    <article className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">ライセンス</h1>
        <p className="text-sm leading-6 text-muted-foreground text-pretty">
          このアプリに含まれるソフトウェアとコンテンツのライセンスです。ビルド時に一覧を作っているので、オフラインでも読めます。
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="licenses-summary">
        <h2 id="licenses-summary" className="text-sm font-medium">
          要約
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          {/*
           * 幅の狭いスマホ（356px 程度）でも折り返しが汚くならないよう、
           * 著作者とリンクは 1 列に縦に並べる。4 列にすると「ライセンス」列が
           * 「BSD-3-Clause」（12px で 79px）に届かず、セルからはみ出す。
           */}
          <table className="w-full table-fixed border-collapse text-left align-top text-xs">
            <caption className="sr-only">ライセンスの要約</caption>
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th scope="col" className="w-[36%] px-3 py-2 font-medium">
                  対象
                </th>
                <th scope="col" className="w-[27%] px-2 py-2 font-medium">
                  ライセンス
                </th>
                <th scope="col" className="w-[37%] px-2 py-2 font-medium">
                  著作者・リンク
                </th>
              </tr>
            </thead>
            {data.sections.map((section) => (
              <tbody key={section.id} className="border-b border-border last:border-b-0">
                <tr className="bg-muted/30">
                  <th
                    scope="colgroup"
                    colSpan={3}
                    className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground"
                  >
                    {section.title}（{section.entries.length}）
                  </th>
                </tr>
                {section.entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="border-t border-border px-3 py-3 text-muted-foreground"
                    >
                      該当するライセンスはありません
                    </td>
                  </tr>
                ) : (
                  section.entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-border">
                      <th scope="row" className="px-3 py-2 align-top font-normal">
                        <span className="break-words">
                          <PackageName name={entry.name} />
                        </span>
                        {entry.version !== null && (
                          <span className="block text-[10px] break-all text-muted-foreground">
                            {entry.version}
                          </span>
                        )}
                      </th>
                      <td className="px-2 py-2 align-top break-words">{entry.license}</td>
                      <td className="px-2 py-2 align-top">
                        <span className="block break-words text-muted-foreground">
                          {entry.author ?? '—'}
                        </span>
                        {entry.url === null ? null : (
                          <a
                            className="flex min-h-11 items-center break-all text-link underline underline-offset-2"
                            href={entry.url}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {linkLabel(entry.url)}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      {data.sections
        .filter((section) => section.entries.length > 0)
        .map((section) => (
          <section
            key={section.id}
            className="flex flex-col gap-3"
            aria-labelledby={`licenses-${section.id}`}
          >
            <div className="flex flex-col gap-1">
              <h2 id={`licenses-${section.id}`} className="text-sm font-medium">
                {section.title}
              </h2>
              <p className="text-xs leading-5 text-muted-foreground text-pretty">
                {section.description}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {section.entries.map((entry) => (
                <LicenseDetails key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        ))}
    </article>
  );
}
