import Testing
@testable import OllamaMenuAssistant

@Test
func chatMarkdownParsesPipeTables() {
    let document = ChatMarkdownDocument.parse(
        """
        范围：

        | 口径 | Reading | Listening |
        |---|---:|:---:|
        | 定义里明确写“复数” | 261 | 352 |
        | 名词且词尾 `s` | 499 | 603 |
        """
    )

    guard case .table(let table) = document.blocks[1] else {
        Issue.record("Expected a table block")
        return
    }

    #expect(table.headers == ["口径", "Reading", "Listening"])
    #expect(table.alignments == [.leading, .trailing, .center])
    #expect(table.rows.count == 2)
    #expect(table.rows[1] == ["名词且词尾 `s`", "499", "603"])
}

@Test
func chatMarkdownKeepsFencedCodeOutOfLists() {
    let document = ChatMarkdownDocument.parse(
        """
        - 外层列表

        ```swift
        - not a list
        ```
        """
    )

    #expect(document.blocks.count == 2)

    guard case .unorderedList(let items) = document.blocks[0] else {
        Issue.record("Expected a list block")
        return
    }
    #expect(items.map(\.text) == ["外层列表"])

    guard case .codeBlock(let language, let code) = document.blocks[1] else {
        Issue.record("Expected a code block")
        return
    }
    #expect(language == "swift")
    #expect(code == "- not a list")
}

@Test
func assistantDisplayContentHidesInternalDirectivesOutsideCodeBlocks() {
    let visible = AssistantDisplayContent.visibleText(
        from:
        """
        完成。
        ::git-stage{cwd="/tmp"}

        ```text
        ::git-stage{cwd="/tmp"}
        ```

        <oai-mem-citation>
        MEMORY.md:1-5
        </oai-mem-citation>
        """
    )

    #expect(!visible.contains("<oai-mem-citation>"))
    #expect(!visible.contains("MEMORY.md"))
    #expect(visible.contains("```text\n::git-stage{cwd=\"/tmp\"}\n```"))
    #expect(visible.hasPrefix("完成。"))
}

@Test
func chatMessageDisplayContentCollapsesInlineImagePayloads() {
    let visible = ChatMessageDisplayContent.visibleText(
        from:
        """
        ## My request for Assistant:
        看下这个截图

        <image name=[Image #1]>
        [Image: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA]
        </image>
        """
    )

    #expect(visible.contains("## My request for Assistant:"))
    #expect(visible.contains("图片附件：Image #1"))
    #expect(!visible.contains("data:image"))
    #expect(!visible.contains("iVBORw0KGgo"))
}
