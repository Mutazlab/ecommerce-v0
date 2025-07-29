import { query } from "@/lib/database/connection"

const USPS_API_URL =
  process.env.NODE_ENV === "production"
    ? "https://secure.shippingapis.com/ShippingAPI.dll"
    : "https://stg-secure.shippingapis.com/ShippingAPI.dll"

const USPS_USER_ID = process.env.USPS_USER_ID!

export interface ShippingAddress {
  name: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
  country: string
}

export interface Package {
  weight: number // in ounces
  length: number // in inches
  width: number
  height: number
  value: number // for insurance
}

// Get shipping rates from USPS
export async function getUSPSRates(origin: ShippingAddress, destination: ShippingAddress, packages: Package[]) {
  try {
    const xml = buildRateRequestXML(origin, destination, packages)

    const response = await fetch(`${USPS_API_URL}?API=RateV4&XML=${encodeURIComponent(xml)}`)
    const xmlText = await response.text()

    // Parse XML response (you might want to use a proper XML parser)
    const rates = parseUSPSRateResponse(xmlText)
    return rates
  } catch (error) {
    console.error("USPS rate calculation error:", error)
    throw new Error("Failed to calculate USPS shipping rates")
  }
}

// Create shipping label
export async function createUSPSLabel(
  orderId: string,
  origin: ShippingAddress,
  destination: ShippingAddress,
  packages: Package[],
  serviceType = "PRIORITY",
) {
  try {
    const xml = buildLabelRequestXML(orderId, origin, destination, packages, serviceType)

    const response = await fetch(`${USPS_API_URL}?API=eVS&XML=${encodeURIComponent(xml)}`)
    const xmlText = await response.text()

    const labelData = parseUSPSLabelResponse(xmlText)

    // Store label information in database
    await query("UPDATE orders SET tracking_number = $1, shipping_label_url = $2 WHERE id = $3", [
      labelData.trackingNumber,
      labelData.labelUrl,
      orderId,
    ])

    return labelData
  } catch (error) {
    console.error("USPS label creation error:", error)
    throw new Error("Failed to create USPS shipping label")
  }
}

// Track package
export async function trackUSPSPackage(trackingNumber: string) {
  try {
    const xml = `
      <TrackFieldRequest USERID="${USPS_USER_ID}">
        <TrackID ID="${trackingNumber}"></TrackID>
      </TrackFieldRequest>
    `

    const response = await fetch(`${USPS_API_URL}?API=TrackV2&XML=${encodeURIComponent(xml)}`)
    const xmlText = await response.text()

    const trackingData = parseUSPSTrackingResponse(xmlText)
    return trackingData
  } catch (error) {
    console.error("USPS tracking error:", error)
    throw new Error("Failed to track USPS package")
  }
}

// Verify address
export async function verifyUSPSAddress(address: Partial<ShippingAddress>) {
  try {
    const xml = `
      <AddressValidateRequest USERID="${USPS_USER_ID}">
        <Address ID="0">
          <Address1>${address.address2 || ""}</Address1>
          <Address2>${address.address1}</Address2>
          <City>${address.city}</City>
          <State>${address.state}</State>
          <Zip5>${address.zip}</Zip5>
          <Zip4></Zip4>
        </Address>
      </AddressValidateRequest>
    `

    const response = await fetch(`${USPS_API_URL}?API=Verify&XML=${encodeURIComponent(xml)}`)
    const xmlText = await response.text()

    const verifiedAddress = parseUSPSAddressResponse(xmlText)
    return verifiedAddress
  } catch (error) {
    console.error("USPS address verification error:", error)
    throw new Error("Failed to verify address with USPS")
  }
}

function buildRateRequestXML(origin: ShippingAddress, destination: ShippingAddress, packages: Package[]) {
  const packagesXML = packages
    .map(
      (pkg, index) => `
    <Package ID="${index}">
      <Service>ALL</Service>
      <ZipOrigination>${origin.zip}</ZipOrigination>
      <ZipDestination>${destination.zip}</ZipDestination>
      <Pounds>${Math.floor(pkg.weight / 16)}</Pounds>
      <Ounces>${pkg.weight % 16}</Ounces>
      <Container>VARIABLE</Container>
      <Size>REGULAR</Size>
      <Width>${pkg.width}</Width>
      <Length>${pkg.length}</Length>
      <Height>${pkg.height}</Height>
      <Girth>${2 * (pkg.width + pkg.height)}</Girth>
      <Value>${pkg.value}</Value>
    </Package>
  `,
    )
    .join("")

  return `
    <RateV4Request USERID="${USPS_USER_ID}">
      ${packagesXML}
    </RateV4Request>
  `
}

function buildLabelRequestXML(
  orderId: string,
  origin: ShippingAddress,
  destination: ShippingAddress,
  packages: Package[],
  serviceType: string,
) {
  // This is a simplified version - actual USPS label API requires more fields
  return `
    <eVSRequest USERID="${USPS_USER_ID}">
      <Option></Option>
      <Revision>1</Revision>
      <ImageParameters></ImageParameters>
      <FromName>${origin.name}</FromName>
      <FromFirm></FromFirm>
      <FromAddress1>${origin.address2 || ""}</FromAddress1>
      <FromAddress2>${origin.address1}</FromAddress2>
      <FromCity>${origin.city}</FromCity>
      <FromState>${origin.state}</FromState>
      <FromZip5>${origin.zip}</FromZip5>
      <FromZip4></FromZip4>
      <ToName>${destination.name}</ToName>
      <ToFirm></ToFirm>
      <ToAddress1>${destination.address2 || ""}</ToAddress1>
      <ToAddress2>${destination.address1}</ToAddress2>
      <ToCity>${destination.city}</ToCity>
      <ToState>${destination.state}</ToState>
      <ToZip5>${destination.zip}</ToZip5>
      <ToZip4></ToZip4>
      <WeightInOunces>${packages[0].weight}</WeightInOunces>
      <ServiceType>${serviceType}</ServiceType>
      <ImageType>PDF</ImageType>
    </eVSRequest>
  `
}

function parseUSPSRateResponse(xmlText: string) {
  // Simplified XML parsing - use a proper XML parser in production
  const rates: any[] = []

  // Extract rate information from XML
  // This is a placeholder - implement proper XML parsing

  return rates
}

function parseUSPSLabelResponse(xmlText: string) {
  // Simplified XML parsing - use a proper XML parser in production
  return {
    trackingNumber: "extracted-tracking-number",
    labelUrl: "extracted-label-url",
    postage: 0,
  }
}

function parseUSPSTrackingResponse(xmlText: string) {
  // Simplified XML parsing - use a proper XML parser in production
  return {
    status: "In Transit",
    location: "Processing Facility",
    timestamp: new Date(),
  }
}

function parseUSPSAddressResponse(xmlText: string) {
  // Simplified XML parsing - use a proper XML parser in production
  return {
    isValid: true,
    correctedAddress: null,
  }
}
