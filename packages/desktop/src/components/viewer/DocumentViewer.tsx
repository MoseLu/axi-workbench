/**
 * Skills Viewer Component
 * Displays document processing capabilities (PDF, PPT, Word, Excel)
 */

import { useState, useRef } from 'react'
import { 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  FileImage,
  File,
  Download,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type DocumentType = 'pdf' | 'pptx' | 'docx' | 'xlsx' | 'image' | 'unknown'

interface DocumentViewerProps {
  isOpen: boolean
  onClose: () => void
  file?: {
    name: string
    path: string
    type: DocumentType
  }
}

export function DocumentViewer({ isOpen, onClose, file }: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load document when opened
  useState(() => {
    if (isOpen && file) {
      loadDocument()
    }
  })

  const loadDocument = async () => {
    if (!file) return
    
    setLoading(true)
    // Simulate loading document
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // For demo, show placeholder content
    setContent(`
      <div style="padding: 40px; font-family: system-ui;">
        <h1 style="font-size: 24px; margin-bottom: 20px;">${file.name}</h1>
        <p style="color: #666;">Document preview would be displayed here.</p>
        <p style="color: #666; margin-top: 10px;">Type: ${file.type.toUpperCase()}</p>
        <p style="color: #666;">Path: ${file.path}</p>
      </div>
    `)
    setTotalPages(5) // Demo value
    setLoading(false)
  }

  const getFileIcon = (type: DocumentType) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />
      case 'pptx':
        return <Presentation className="h-5 w-5 text-orange-500" />
      case 'docx':
        return <FileText className="h-5 w-5 text-blue-500" />
      case 'xlsx':
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />
      case 'image':
        return <FileImage className="h-5 w-5 text-purple-500" />
      default:
        return <File className="h-5 w-5 text-gray-500" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex bg-black/80">
      {/* Main Viewer Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 border-b flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-2">
            {file && getFileIcon(file.type)}
            <span className="font-medium">{file?.name || 'Document Viewer'}</span>
            {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(25, z - 25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-14 text-center">{zoom}%</span>
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(200, z + 25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-2" />

            {/* Page Navigation */}
            {totalPages > 1 && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {currentPage} / {totalPages}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Document Content */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-8"
        >
          {content ? (
            <div 
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}
              className="bg-background shadow-lg transition-transform"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <File className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>No document loaded</p>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - Document Info */}
      <div className="w-72 border-l bg-card p-4">
        <h3 className="font-semibold mb-4">Document Info</h3>
        
        {file ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">File Name</label>
              <p className="text-sm font-medium truncate">{file.name}</p>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <p className="text-sm font-medium uppercase">{file.type}</p>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">Pages</label>
              <p className="text-sm font-medium">{totalPages}</p>
            </div>

            <div className="pt-4 border-t space-y-2">
              <Button variant="outline" className="w-full" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Export as Text
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p>Select a document to view its contents.</p>
            <p className="mt-2">Supported formats:</p>
            <ul className="mt-1 list-disc list-inside">
              <li>PDF (.pdf)</li>
              <li>Word (.docx)</li>
              <li>PowerPoint (.pptx)</li>
              <li>Excel (.xlsx)</li>
              <li>Images</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
