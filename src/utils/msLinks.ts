export function buildMsVerifyLink(productName: string, featureName: string) {
  const appName = productName.replace('Dynamics 365 ', '').replace('Microsoft ', '').trim()
  const params = new URLSearchParams({ app: appName, q: featureName })
  return `https://releaseplans.microsoft.com/en-us/?${params.toString()}`
}
