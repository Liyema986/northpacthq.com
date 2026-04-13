"use client";

import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { ProposalPDFData } from "@/lib/pdf-types";

// Create dynamic styles function that accepts brand colors
const createStyles = (primaryColor: string = "#5DBEB4", secondaryColor: string = "#4A90E2") =>
  StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 11,
      fontFamily: "Helvetica",
      backgroundColor: "#ffffff",
    },
    header: {
      marginBottom: 30,
      borderBottom: 2,
      borderBottomColor: primaryColor,
      paddingBottom: 15,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerLeft: {
      flex: 1,
    },
    logo: {
      width: 80,
      height: 80,
      objectFit: "contain",
    },
    firmName: {
      fontSize: 24,
      fontWeight: "bold",
      color: primaryColor,
      marginBottom: 5,
    },
  proposalNumber: {
    fontSize: 10,
    color: "#6B7280",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1F2937",
  },
  clientInfo: {
    marginBottom: 5,
    fontSize: 10,
  },
  servicesTable: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    padding: 8,
    fontWeight: "bold",
    fontSize: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: 1,
    borderBottomColor: "#E5E7EB",
    padding: 8,
    fontSize: 10,
  },
  col1: {
    width: "50%",
  },
  col2: {
    width: "15%",
    textAlign: "right",
  },
  col3: {
    width: "15%",
    textAlign: "right",
  },
  col4: {
    width: "20%",
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 10,
    borderTop: 2,
    borderTopColor: primaryColor,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginRight: 20,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: primaryColor,
  },
  intro: {
    marginBottom: 15,
    lineHeight: 1.5,
    color: "#4B5563",
  },
  terms: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    fontSize: 9,
    lineHeight: 1.4,
    color: "#6B7280",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#9CA3AF",
    borderTop: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
  },
  badge: {
    backgroundColor: secondaryColor,
    color: "#ffffff",
    padding: "4 8",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: "bold",
  },
});

/** Accepts ProposalPDFData from lib/pdf-types.ts for shared contract */
export type ProposalPDFProps = ProposalPDFData;

export const ProposalPDF = ({
  firmName,
  proposalNumber,
  title,
  clientName,
  clientEmail = "",
  services,
  total,
  currency = "ZAR",
  introText,
  termsText,
  validUntil,
  createdAt,
  firmLogo,
  brandColors,
  footerText,
  footerAddress,
  disclaimer,
  signOffBlock,
  bankingDetails,
  coverImageUrl,
  footerImageUrl,
  lastPageImageUrl,
}: ProposalPDFProps) => {
  // Create styles with brand colors
  const styles = createStyles(
    brandColors?.primary || "#5DBEB4",
    brandColors?.secondary || "#4A90E2"
  );
  const formatCurrency = (amount: number) => {
    const n = Number(amount);
    const locale = currency === "ZAR" ? "en-ZA" : "en-US";
    if (n !== n || !Number.isFinite(n)) {
      return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2 }).format(0);
    }
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Document>
      {/* Cover page: optional full-page image (Settings > Proposals) */}
      {coverImageUrl && (
        <Page size="A4" style={styles.page}>
          <Image
            src={coverImageUrl}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
          />
        </Page>
      )}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.firmName}>{firmName}</Text>
            <Text style={styles.proposalNumber}>Proposal #{proposalNumber}</Text>
          </View>
          {firmLogo && (
            <Image
              src={firmLogo}
              style={styles.logo}
            />
          )}
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 10, color: "#6B7280" }}>
            Date: {formatDate(createdAt)}
          </Text>
          {validUntil && (
            <Text style={{ fontSize: 10, color: "#6B7280" }}>
              Valid until: {formatDate(validUntil)}
            </Text>
          )}
        </View>

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prepared For:</Text>
          <Text style={styles.clientInfo}>{clientName}</Text>
          <Text style={styles.clientInfo}>{clientEmail}</Text>
        </View>

        {/* Introduction */}
        {introText && (
          <View style={styles.section}>
            <Text style={styles.intro}>{introText}</Text>
          </View>
        )}

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.servicesTable}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Description</Text>
              <Text style={styles.col2}>Qty</Text>
              <Text style={styles.col3}>Rate</Text>
              <Text style={styles.col4}>Amount</Text>
            </View>

            {/* Table Rows */}
            {services.map((service, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.col1}>{service.serviceName}</Text>
                <Text style={styles.col2}>{service.quantity}</Text>
                <Text style={styles.col3}>{formatCurrency(service.unitPrice ?? 0)}</Text>
                <Text style={styles.col4}>{formatCurrency(service.subtotal)}</Text>
              </View>
            ))}

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>

        {/* Terms */}
        {termsText && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <View style={styles.terms}>
              <Text>{termsText}</Text>
            </View>
          </View>
        )}

        {/* Footer: use Settings > Proposals config when set; optional footer image */}
        <View style={styles.footer}>
          {footerImageUrl && (
            <Image src={footerImageUrl} style={{ width: "100%", maxHeight: 40, objectFit: "contain", marginBottom: 6 }} />
          )}
          {(footerText || footerAddress || disclaimer) ? (
            <>
              {footerText ? <Text>{footerText}</Text> : null}
              {footerAddress ? <Text>{footerAddress}</Text> : null}
              {disclaimer ? <Text style={{ marginTop: 4, fontSize: 7 }}>{disclaimer}</Text> : null}
            </>
          ) : (
            <>
              <Text>
                This proposal is valid until {validUntil ? formatDate(validUntil) : "further notice"}.
              </Text>
              <Text>Thank you for considering {firmName}.</Text>
            </>
          )}
        </View>
      </Page>

      {/* Last page: optional image/background, sign-off and banking details (Settings > Proposals) */}
      {(signOffBlock || bankingDetails || lastPageImageUrl) ? (
        <Page size="A4" style={styles.page}>
          {lastPageImageUrl && (
            <Image
              src={lastPageImageUrl}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
          )}
          <View style={[styles.section, lastPageImageUrl ? { position: "relative" as const, zIndex: 1, backgroundColor: "white", padding: 16, borderRadius: 4 } : {}]}>
            {signOffBlock ? (
              <>
                <Text style={styles.sectionTitle}>Sign-off</Text>
                <Text style={styles.intro}>{signOffBlock}</Text>
              </>
            ) : null}
            {bankingDetails ? (
              <>
                <Text style={{ ...styles.sectionTitle, marginTop: 20 }}>Banking details</Text>
                <Text style={styles.terms}>{bankingDetails}</Text>
              </>
            ) : null}
          </View>
          <View style={[styles.footer, lastPageImageUrl ? { position: "relative" as const, zIndex: 1, backgroundColor: "white" } : {}]}>
            {(footerText || footerAddress || disclaimer) ? (
              <>
                {footerText ? <Text>{footerText}</Text> : null}
                {footerAddress ? <Text>{footerAddress}</Text> : null}
                {disclaimer ? <Text style={{ marginTop: 4, fontSize: 7 }}>{disclaimer}</Text> : null}
              </>
            ) : (
              <Text>Thank you for considering {firmName}.</Text>
            )}
          </View>
        </Page>
      ) : null}
    </Document>
  );
};
