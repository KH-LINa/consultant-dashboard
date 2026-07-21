import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Rendu markdown des sorties des agents (le projet n'utilise pas
 * @tailwindcss/typography : les styles sont portés par les composants).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2" {...props} />,
        h2: (props) => <h2 className="text-lg font-bold text-gray-900 mt-4 mb-2" {...props} />,
        h3: (props) => <h3 className="text-base font-semibold text-gray-900 mt-3 mb-1.5" {...props} />,
        h4: (props) => <h4 className="text-sm font-semibold text-gray-900 mt-3 mb-1" {...props} />,
        p: (props) => <p className="text-sm text-gray-700 leading-relaxed my-2" {...props} />,
        ul: (props) => <ul className="list-disc pl-5 my-2 space-y-1 text-sm text-gray-700" {...props} />,
        ol: (props) => <ol className="list-decimal pl-5 my-2 space-y-1 text-sm text-gray-700" {...props} />,
        li: (props) => <li className="leading-relaxed" {...props} />,
        strong: (props) => <strong className="font-semibold text-gray-900" {...props} />,
        a: (props) => <a className="text-[#534AB7] underline" target="_blank" rel="noreferrer" {...props} />,
        blockquote: (props) => (
          <blockquote className="border-l-4 border-[#534AB7]/30 pl-3 my-2 text-sm text-gray-600 italic" {...props} />
        ),
        hr: () => <hr className="my-4 border-gray-200" />,
        table: (props) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse" {...props} />
          </div>
        ),
        thead: (props) => <thead className="bg-gray-50" {...props} />,
        th: (props) => (
          <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold text-gray-900" {...props} />
        ),
        td: (props) => <td className="border border-gray-200 px-3 py-1.5 text-gray-700 align-top" {...props} />,
        code: ({ className, children, ...props }) => {
          // Blocs de code (```…```) vs code inline
          const isBlock = /language-/.test(className ?? '') || String(children).includes('\n')
          return isBlock ? (
            <code className={`block ${className ?? ''}`} {...props}>
              {children}
            </code>
          ) : (
            <code className="bg-gray-100 rounded px-1 py-0.5 text-[13px] font-mono text-gray-800" {...props}>
              {children}
            </code>
          )
        },
        pre: (props) => (
          <pre
            className="bg-gray-900 text-gray-100 rounded-lg p-3 my-3 overflow-x-auto text-[13px] font-mono leading-relaxed"
            {...props}
          />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
