/**
 * PDF Report Generator for ProProposals
 * Comprehensive PDF generation using jsPDF and jspdf-autotable
 * Supports headers, footers, tables, charts, and custom styling
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function formatDate(date: Date, style: 'short' | 'datetime' = 'short'): string {
  if (style === 'datetime') {
    return date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface ReportConfig {
  title: string
  subtitle?: string
  dateRange?: string
  filters?: Record<string, string>
  generatedBy?: string
  logoDataUrl?: string
  organizationName?: string
  companyInfo?: {
    name: string
    address?: string
    phone?: string
    email?: string
    website?: string
  }
  brandColor?: [number, number, number]
}

export interface ReportSummary {
  totalItems: number
  totalValue?: number
  approvedItems?: number
  pendingItems?: number
  rejectedItems?: number
  sentItems?: number
  draftItems?: number
  conversionRate?: number
  avgProcessingTime?: number
  customStats?: { label: string; value: string | number; color?: string }[]
}

export interface ProposalSummary {
  proposalNumber: string
  clientName: string
  clientEmail: string
  services: { name: string; quantity: number; price: number }[]
  subtotal: number
  tax?: number
  total: number
  validUntil?: string
  terms?: string
  introduction?: string
}

export interface ReportCharts {
  statusChart?: string
  typeChart?: string
  revenueChart?: string
  trendChart?: string
  customCharts?: { title: string; dataUrl: string; height?: number }[]
}

export interface TableConfig {
  title?: string
  headers: string[]
  data: (string | number)[][]
  columnStyles?: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number | 'auto' }>
  showTotals?: boolean
  totalsRow?: (string | number)[]
}

export interface MonthlyBreakdown {
  month: string
  proposals: number
  sent: number
  accepted: number
  rejected: number
  totalValue?: number
}

export interface ReportData {
  config: ReportConfig
  summary?: ReportSummary
  proposal?: ProposalSummary
  charts?: ReportCharts
  tables?: TableConfig[]
  monthlyData?: MonthlyBreakdown[]
  rawData?: any[]
}

// ============================================================================
// COLOR THEME
// ============================================================================

export const PDF_THEME = {
  primary: [37, 99, 235] as [number, number, number], // Blue-600 (ProProposals brand)
  primaryLight: [96, 165, 250] as [number, number, number], // Blue-400
  secondary: [75, 85, 99] as [number, number, number], // Gray-600
  success: [16, 185, 129] as [number, number, number], // Emerald-500
  successLight: [209, 250, 229] as [number, number, number], // Emerald-100
  warning: [245, 158, 11] as [number, number, number], // Amber-500
  warningLight: [254, 243, 199] as [number, number, number], // Amber-100
  error: [239, 68, 68] as [number, number, number], // Red-500
  errorLight: [254, 226, 226] as [number, number, number], // Red-100
  info: [59, 130, 246] as [number, number, number], // Blue-500
  infoLight: [219, 234, 254] as [number, number, number], // Blue-100
  purple: [168, 85, 247] as [number, number, number], // Purple-500
  purpleLight: [243, 232, 255] as [number, number, number], // Purple-100
  gray: [249, 250, 251] as [number, number, number], // Gray-50
  grayBorder: [209, 213, 219] as [number, number, number], // Gray-300
  grayText: [107, 114, 128] as [number, number, number], // Gray-500
  black: [0, 0, 0] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

// ============================================================================
// PDF REPORT GENERATOR CLASS
// ============================================================================

export class PDFReportGenerator {
  private doc: jsPDF
  private pageWidth: number
  private pageHeight: number
  private margin: number
  private currentY: number
  private config: ReportConfig
  private primaryColor: [number, number, number]

  constructor(config?: Partial<ReportConfig>) {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    this.pageWidth = this.doc.internal.pageSize.getWidth()
    this.pageHeight = this.doc.internal.pageSize.getHeight()
    this.margin = 15
    this.currentY = this.margin
    this.config = {
      title: 'Report',
      organizationName: 'ProProposals',
      ...config
    }
    this.primaryColor = config?.brandColor || PDF_THEME.primary
  }

  // ============================================================================
  // HEADER SECTION
  // ============================================================================

  private addHeader(): void {
    const { title, subtitle, logoDataUrl } = this.config

    if (logoDataUrl) {
      try {
        const logoSize = 18
        const logoWidth = logoSize * 1.5
        this.doc.addImage(logoDataUrl, 'PNG', this.margin, this.currentY, logoWidth, logoSize)
        
        const titleX = this.margin + logoWidth + 5
        this.doc.setFontSize(20)
        this.doc.setFont('helvetica', 'bold')
        this.doc.setTextColor(...this.primaryColor)
        this.doc.text(title, titleX, this.currentY + 8)
        
        if (subtitle) {
          this.doc.setFontSize(10)
          this.doc.setFont('helvetica', 'normal')
          this.doc.setTextColor(...PDF_THEME.secondary)
          this.doc.text(subtitle, titleX, this.currentY + 14)
        }
        
        this.currentY += logoSize + 3
      } catch (error) {
        console.error('Error adding logo:', error)
        this.addTextOnlyHeader()
      }
    } else {
      this.addTextOnlyHeader()
    }

    // Add separator line
    this.doc.setLineWidth(0.5)
    this.doc.setDrawColor(...this.primaryColor)
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY)
    this.currentY += 10
  }

  private addTextOnlyHeader(): void {
    const { title, subtitle } = this.config

    this.doc.setFontSize(22)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...this.primaryColor)
    this.doc.text(title, this.margin, this.currentY)
    this.currentY += 10

    if (subtitle) {
      this.doc.setFontSize(11)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setTextColor(...PDF_THEME.secondary)
      this.doc.text(subtitle, this.margin, this.currentY)
      this.currentY += 8
    }
  }

  // ============================================================================
  // METADATA SECTION
  // ============================================================================

  private addMetadata(): void {
    const { dateRange, filters, generatedBy, organizationName } = this.config
    this.checkPageBreak(50)
    
    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...PDF_THEME.black)
    this.doc.text('Report Information', this.margin, this.currentY)
    this.currentY += 8

    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setTextColor(...PDF_THEME.secondary)
    
    const metadata: string[] = []
    
    if (organizationName) {
      metadata.push(`Organization: ${organizationName}`)
    }
    if (dateRange) {
      metadata.push(`Date Range: ${dateRange}`)
    }
    metadata.push(`Generated: ${formatDate(new Date())}`)
    if (generatedBy) {
      metadata.push(`Generated By: ${generatedBy}`)
    }

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
          metadata.push(`${formattedKey}: ${value.replace(/_/g, ' ').toUpperCase()}`)
        }
      })
    }

    metadata.forEach(line => {
      this.doc.text(line, this.margin + 2, this.currentY)
      this.currentY += 5
    })

    this.currentY += 5
  }

  // ============================================================================
  // SUMMARY CARDS
  // ============================================================================

  addSummaryCards(summary: ReportSummary): void {
    this.checkPageBreak(70)
    
    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...PDF_THEME.black)
    this.doc.text('Executive Summary', this.margin, this.currentY)
    this.currentY += 8

    const cardWidth = (this.pageWidth - (this.margin * 2) - 15) / 3
    const cardHeight = 25
    const cardGap = 5

    // Row 1: Total, Sent, Drafts
    this.addStatCard(
      this.margin,
      this.currentY,
      cardWidth,
      cardHeight,
      summary.totalItems.toString(),
      'Total Proposals',
      PDF_THEME.info,
      PDF_THEME.infoLight
    )

    if (summary.sentItems !== undefined) {
      this.addStatCard(
        this.margin + cardWidth + cardGap,
        this.currentY,
        cardWidth,
        cardHeight,
        summary.sentItems.toString(),
        'Sent',
        PDF_THEME.success,
        PDF_THEME.successLight
      )
    }

    if (summary.draftItems !== undefined) {
      this.addStatCard(
        this.margin + (cardWidth + cardGap) * 2,
        this.currentY,
        cardWidth,
        cardHeight,
        summary.draftItems.toString(),
        'Drafts',
        PDF_THEME.warning,
        PDF_THEME.warningLight
      )
    }

    this.currentY += cardHeight + cardGap

    // Row 2: Approved, Rejected, Total Value
    if (summary.approvedItems !== undefined) {
      this.addStatCard(
        this.margin,
        this.currentY,
        cardWidth,
        cardHeight,
        summary.approvedItems.toString(),
        'Accepted',
        PDF_THEME.success,
        PDF_THEME.successLight
      )
    }

    if (summary.rejectedItems !== undefined) {
      this.addStatCard(
        this.margin + cardWidth + cardGap,
        this.currentY,
        cardWidth,
        cardHeight,
        summary.rejectedItems.toString(),
        'Declined',
        PDF_THEME.error,
        PDF_THEME.errorLight
      )
    }

    if (summary.totalValue !== undefined) {
      this.addStatCard(
        this.margin + (cardWidth + cardGap) * 2,
        this.currentY,
        cardWidth,
        cardHeight,
        `$${summary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        'Total Value',
        PDF_THEME.purple,
        PDF_THEME.purpleLight
      )
    }

    this.currentY += cardHeight + 10

    // Conversion rate if available
    if (summary.conversionRate !== undefined) {
      const rateCardWidth = (this.pageWidth - (this.margin * 2)) / 2
      this.addStatCard(
        this.margin + rateCardWidth / 2,
        this.currentY,
        rateCardWidth,
        cardHeight,
        `${summary.conversionRate.toFixed(1)}%`,
        'Conversion Rate',
        PDF_THEME.primary,
        PDF_THEME.infoLight
      )
      this.currentY += cardHeight + 10
    }

    // Custom stats
    if (summary.customStats && summary.customStats.length > 0) {
      const customCardWidth = (this.pageWidth - (this.margin * 2) - (summary.customStats.length - 1) * cardGap) / summary.customStats.length
      
      summary.customStats.forEach((stat, index) => {
        this.addStatCard(
          this.margin + (index * (customCardWidth + cardGap)),
          this.currentY,
          customCardWidth,
          cardHeight,
          stat.value.toString(),
          stat.label,
          PDF_THEME.info,
          PDF_THEME.infoLight
        )
      })
      
      this.currentY += cardHeight + 10
    }
  }

  private addStatCard(
    x: number,
    y: number,
    width: number,
    height: number,
    value: string,
    label: string,
    color: [number, number, number],
    bgColor: [number, number, number]
  ): void {
    // Background
    this.doc.setFillColor(...bgColor)
    this.doc.setDrawColor(...color)
    this.doc.setLineWidth(0.3)
    this.doc.roundedRect(x, y, width, height, 2, 2, 'FD')

    // Value
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(14)
    this.doc.setTextColor(...color)
    this.doc.text(value, x + width / 2, y + height / 2 - 2, { align: 'center' })

    // Label
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.setTextColor(...color)
    this.doc.text(label, x + width / 2, y + height / 2 + 6, { align: 'center' })
  }

  // ============================================================================
  // PROPOSAL DOCUMENT
  // ============================================================================

  addProposalContent(proposal: ProposalSummary): void {
    this.checkPageBreak(100)

    // Proposal Number
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...PDF_THEME.black)
    this.doc.text(`Proposal #${proposal.proposalNumber}`, this.margin, this.currentY)
    this.currentY += 10

    // Client Information
    this.addSectionHeader('Client Information')
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setTextColor(...PDF_THEME.secondary)
    this.doc.text(`Client: ${proposal.clientName}`, this.margin + 2, this.currentY)
    this.currentY += 5
    this.doc.text(`Email: ${proposal.clientEmail}`, this.margin + 2, this.currentY)
    this.currentY += 10

    // Introduction
    if (proposal.introduction) {
      this.addSectionHeader('Introduction')
      this.addParagraph(proposal.introduction)
    }

    // Services Table
    this.addSectionHeader('Services')
    const servicesTable: TableConfig = {
      headers: ['Service', 'Quantity', 'Unit Price', 'Total'],
      data: proposal.services.map(s => [
        s.name,
        s.quantity.toString(),
        `$${s.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `$${(s.quantity * s.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      ]),
      showTotals: true,
      totalsRow: [
        'Subtotal',
        '',
        '',
        `$${proposal.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      ],
      columnStyles: {
        0: { halign: 'left', cellWidth: 80 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 }
      }
    }
    this.addTable(servicesTable)

    // Tax and Total
    if (proposal.tax !== undefined) {
      this.doc.setFontSize(10)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setTextColor(...PDF_THEME.secondary)
      this.doc.text(`Tax: $${proposal.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, this.pageWidth - this.margin - 50, this.currentY, { align: 'left' })
      this.currentY += 6
    }

    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...this.primaryColor)
    this.doc.text(`Total: $${proposal.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, this.pageWidth - this.margin - 50, this.currentY, { align: 'left' })
    this.currentY += 15

    // Valid Until
    if (proposal.validUntil) {
      this.doc.setFontSize(10)
      this.doc.setFont('helvetica', 'italic')
      this.doc.setTextColor(...PDF_THEME.warning)
      this.doc.text(`Valid Until: ${proposal.validUntil}`, this.margin, this.currentY)
      this.currentY += 10
    }

    // Terms
    if (proposal.terms) {
      this.addSectionHeader('Terms & Conditions')
      this.addParagraph(proposal.terms)
    }
  }

  // ============================================================================
  // CHARTS
  // ============================================================================

  addChart(chartDataUrl: string, title: string, height: number = 70): void {
    if (!chartDataUrl) return

    this.checkPageBreak(height + 20)

    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...PDF_THEME.black)
    this.doc.text(title, this.margin, this.currentY)
    this.currentY += 6

    try {
      const chartWidth = this.pageWidth - (this.margin * 2)
      this.doc.addImage(chartDataUrl, 'PNG', this.margin, this.currentY, chartWidth, height)
      this.currentY += height + 8
    } catch (error) {
      console.error('Error adding chart:', error)
      this.doc.setFontSize(10)
      this.doc.setTextColor(150, 150, 150)
      this.doc.text('Chart could not be rendered', this.margin + 5, this.currentY + 5)
      this.currentY += 15
    }
  }

  addCharts(charts: ReportCharts): void {
    if (charts.statusChart) {
      this.addChart(charts.statusChart, 'Proposal Status Distribution', 65)
    }
    if (charts.revenueChart) {
      this.addChart(charts.revenueChart, 'Revenue by Service', 65)
    }
    if (charts.trendChart) {
      this.addChart(charts.trendChart, 'Monthly Trend', 60)
    }
    if (charts.customCharts) {
      charts.customCharts.forEach(chart => {
        this.addChart(chart.dataUrl, chart.title, chart.height || 60)
      })
    }
  }

  // ============================================================================
  // TABLES
  // ============================================================================

  addTable(tableConfig: TableConfig): void {
    this.checkPageBreak(60)

    if (tableConfig.title) {
      this.doc.setFontSize(14)
      this.doc.setFont('helvetica', 'bold')
      this.doc.setTextColor(...PDF_THEME.black)
      this.doc.text(tableConfig.title, this.margin, this.currentY)
      this.currentY += 8
    }

    const tableData = [...tableConfig.data]
    
    if (tableConfig.showTotals && tableConfig.totalsRow) {
      tableData.push(tableConfig.totalsRow)
    }

    autoTable(this.doc, {
      startY: this.currentY,
      head: [tableConfig.headers],
      body: tableData.map(row => row.map(cell => String(cell))),
      theme: 'grid',
      headStyles: {
        fillColor: this.primaryColor,
        textColor: PDF_THEME.white,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
        cellPadding: 3
      },
      bodyStyles: {
        halign: 'center',
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [50, 50, 50]
      },
      columnStyles: tableConfig.columnStyles || {},
      alternateRowStyles: {
        fillColor: PDF_THEME.gray
      },
      margin: { left: this.margin, right: this.margin },
      didDrawPage: (data) => {
        this.currentY = data.cursor?.y || this.currentY
      },
      didParseCell: (data) => {
        // Highlight totals row
        if (tableConfig.showTotals && data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = PDF_THEME.infoLight
          data.cell.styles.textColor = this.primaryColor
        }
      }
    })

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10
  }

  // ============================================================================
  // MONTHLY BREAKDOWN
  // ============================================================================

  addMonthlyBreakdown(monthlyData: MonthlyBreakdown[]): void {
    this.checkPageBreak(80)

    this.doc.setFontSize(14)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...PDF_THEME.black)
    this.doc.text('Monthly Performance', this.margin, this.currentY)
    this.currentY += 8

    if (monthlyData.length === 0) {
      this.doc.setFontSize(10)
      this.doc.setTextColor(150, 150, 150)
      this.doc.text('No monthly data available', this.margin + 5, this.currentY)
      this.currentY += 10
      return
    }

    // Calculate totals
    const totals = {
      proposals: monthlyData.reduce((sum, d) => sum + d.proposals, 0),
      sent: monthlyData.reduce((sum, d) => sum + d.sent, 0),
      accepted: monthlyData.reduce((sum, d) => sum + d.accepted, 0),
      rejected: monthlyData.reduce((sum, d) => sum + d.rejected, 0),
      totalValue: monthlyData.reduce((sum, d) => sum + (d.totalValue || 0), 0)
    }

    const hasValue = monthlyData.some(d => d.totalValue !== undefined)
    
    const headers = hasValue 
      ? ['Month', 'Created', 'Sent', 'Accepted', 'Declined', 'Value']
      : ['Month', 'Created', 'Sent', 'Accepted', 'Declined']

    const tableData = monthlyData.map(row => {
      const baseRow = [
        row.month,
        row.proposals.toString(),
        row.sent.toString(),
        row.accepted.toString(),
        row.rejected.toString()
      ]
      if (hasValue) {
        baseRow.push(`$${(row.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
      }
      return baseRow
    })

    const totalsRow = hasValue
      ? ['TOTAL', totals.proposals.toString(), totals.sent.toString(), totals.accepted.toString(), totals.rejected.toString(), `$${totals.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]
      : ['TOTAL', totals.proposals.toString(), totals.sent.toString(), totals.accepted.toString(), totals.rejected.toString()]

    tableData.push(totalsRow)

    autoTable(this.doc, {
      startY: this.currentY,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: this.primaryColor,
        textColor: PDF_THEME.white,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
        cellPadding: 3
      },
      bodyStyles: {
        halign: 'center',
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [50, 50, 50]
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'normal', cellWidth: 25 },
        ...(hasValue ? { 5: { halign: 'right' } } : {})
      },
      alternateRowStyles: {
        fillColor: PDF_THEME.gray
      },
      margin: { left: this.margin, right: this.margin },
      didDrawPage: (data) => {
        this.currentY = data.cursor?.y || this.currentY
      },
      didParseCell: (data) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = PDF_THEME.infoLight
          data.cell.styles.textColor = this.primaryColor
        }
      }
    })

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10
  }

  // ============================================================================
  // SECTION HEADER
  // ============================================================================

  addSectionHeader(title: string): void {
    this.checkPageBreak(20)

    this.doc.setFillColor(...this.primaryColor)
    this.doc.roundedRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 8, 1, 1, 'F')
    
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...PDF_THEME.white)
    this.doc.text(title, this.pageWidth / 2, this.currentY + 5.5, { align: 'center' })
    
    this.currentY += 12
  }

  // ============================================================================
  // TEXT CONTENT
  // ============================================================================

  addParagraph(text: string, options?: { bold?: boolean; fontSize?: number; color?: [number, number, number] }): void {
    this.checkPageBreak(20)

    const opts = {
      bold: false,
      fontSize: 10,
      color: PDF_THEME.black,
      ...options
    }

    this.doc.setFontSize(opts.fontSize)
    this.doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    this.doc.setTextColor(...opts.color)

    const lines = this.doc.splitTextToSize(text, this.pageWidth - (this.margin * 2))
    this.doc.text(lines, this.margin, this.currentY)
    this.currentY += (lines.length * opts.fontSize * 0.4) + 5
  }

  addBulletList(items: string[]): void {
    this.checkPageBreak(items.length * 8)

    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setTextColor(...PDF_THEME.black)

    items.forEach(item => {
      this.doc.text(`• ${item}`, this.margin + 3, this.currentY)
      this.currentY += 6
    })

    this.currentY += 5
  }

  // ============================================================================
  // SIGNATURE SECTION
  // ============================================================================

  addSignatureSection(): void {
    this.checkPageBreak(60)

    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...PDF_THEME.black)
    this.doc.text('Acceptance', this.margin, this.currentY)
    this.currentY += 10

    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setTextColor(...PDF_THEME.secondary)
    this.doc.text('By signing below, you agree to the terms and conditions outlined in this proposal.', this.margin, this.currentY)
    this.currentY += 15

    // Signature line
    this.doc.setDrawColor(...PDF_THEME.grayBorder)
    this.doc.setLineWidth(0.5)
    this.doc.line(this.margin, this.currentY, this.margin + 70, this.currentY)
    this.doc.text('Client Signature', this.margin, this.currentY + 5)

    // Date line
    this.doc.line(this.pageWidth - this.margin - 50, this.currentY, this.pageWidth - this.margin, this.currentY)
    this.doc.text('Date', this.pageWidth - this.margin - 50, this.currentY + 5)

    this.currentY += 20
  }

  // ============================================================================
  // FOOTER
  // ============================================================================

  private addFooter(): void {
    const pageCount = (this.doc as any).getNumberOfPages()
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i)
      
      const footerY = this.pageHeight - 10
      
      // Separator line
      this.doc.setDrawColor(200, 200, 200)
      this.doc.setLineWidth(0.2)
      this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15)
      
      // Page number
      this.doc.setFontSize(8)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setTextColor(100, 100, 100)
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.pageWidth / 2,
        footerY,
        { align: 'center' }
      )
      
      // Organization name
      this.doc.setFontSize(7)
      this.doc.text(
        this.config.organizationName || 'ProProposals',
        this.margin,
        footerY,
        { align: 'left' }
      )

      // Generated timestamp
      this.doc.text(
        formatDate(new Date(), 'datetime'),
        this.pageWidth - this.margin,
        footerY,
        { align: 'right' }
      )
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private checkPageBreak(requiredSpace: number, forceNewPage: boolean = false): void {
    if (forceNewPage || this.currentY + requiredSpace > this.pageHeight - 25) {
      this.doc.addPage()
      this.currentY = this.margin + 10
    }
  }

  addNewPage(): void {
    this.doc.addPage()
    this.currentY = this.margin + 10
  }

  setThemeColor(color: [number, number, number]): void {
    this.primaryColor = color
  }

  // ============================================================================
  // GENERATION
  // ============================================================================

  async generateReport(reportData: ReportData): Promise<Blob> {
    // Update config if provided in reportData
    this.config = { ...this.config, ...reportData.config }

    // Page 1: Header, Metadata, Summary
    this.addHeader()
    this.addMetadata()
    
    if (reportData.summary) {
      this.addSummaryCards(reportData.summary)
    }

    // Charts
    if (reportData.charts) {
      this.addCharts(reportData.charts)
    }

    // Monthly breakdown
    if (reportData.monthlyData && reportData.monthlyData.length > 0) {
      this.addMonthlyBreakdown(reportData.monthlyData)
    }

    // Custom tables
    if (reportData.tables) {
      reportData.tables.forEach(table => {
        this.addTable(table)
      })
    }

    // Add footer to all pages
    this.addFooter()

    return this.doc.output('blob')
  }

  async generateProposalPDF(proposalData: ProposalSummary, firmConfig?: Partial<ReportConfig>): Promise<Blob> {
    this.config = { ...this.config, ...firmConfig, title: `Proposal #${proposalData.proposalNumber}` }
    
    if (firmConfig?.brandColor) {
      this.primaryColor = firmConfig.brandColor
    }

    this.addHeader()
    this.addProposalContent(proposalData)
    this.addSignatureSection()
    this.addFooter()

    return this.doc.output('blob')
  }

  savePDF(filename: string = 'report.pdf'): void {
    this.addFooter()
    this.doc.save(filename)
  }

  getPDFDataUrl(): string {
    this.addFooter()
    return this.doc.output('dataurlstring')
  }

  getDocument(): jsPDF {
    return this.doc
  }
}

// ============================================================================
// QUICK GENERATOR FUNCTIONS
// ============================================================================

/**
 * Generate a quick summary report
 */
export async function generateSummaryReport(
  title: string,
  summary: ReportSummary,
  charts?: ReportCharts,
  options?: Partial<ReportConfig>
): Promise<Blob> {
  const generator = new PDFReportGenerator({
    title,
    ...options
  })

  return generator.generateReport({
    config: { title, ...options },
    summary,
    charts
  })
}

/**
 * Generate a table-based report
 */
export async function generateTableReport(
  title: string,
  tables: TableConfig[],
  options?: Partial<ReportConfig>
): Promise<Blob> {
  const generator = new PDFReportGenerator({
    title,
    ...options
  })

  return generator.generateReport({
    config: { title, ...options },
    tables
  })
}

/**
 * Generate a proposal PDF
 */
export async function generateProposalPDF(
  proposal: ProposalSummary,
  firmConfig?: Partial<ReportConfig>
): Promise<Blob> {
  const generator = new PDFReportGenerator(firmConfig)
  return generator.generateProposalPDF(proposal, firmConfig)
}

/**
 * Generate a monthly performance report
 */
export async function generateMonthlyReport(
  title: string,
  monthlyData: MonthlyBreakdown[],
  summary?: ReportSummary,
  options?: Partial<ReportConfig>
): Promise<Blob> {
  const generator = new PDFReportGenerator({
    title,
    ...options
  })

  return generator.generateReport({
    config: { title, ...options },
    summary,
    monthlyData
  })
}
