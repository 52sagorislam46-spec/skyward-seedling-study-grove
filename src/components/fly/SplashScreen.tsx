import flyLogo from "@/assets/fly-logo-cropped.png.asset.json";

/** Branded launch screen shown while the app checks sign-in. */
export function SplashScreen() {
  return (
    <div className="fly-splash" role="status" aria-label="Fly লোড হচ্ছে">
      <div className="fly-splash-glow" />
      <div className="fly-splash-logo-wrap">
        <img src={flyLogo.url} alt="Fly" className="fly-splash-logo" />
      </div>
      <div className="fly-splash-bottom">
        <div className="fly-splash-bar"><span /></div>
        <p className="fly-splash-text">Fly • Connect &amp; Share</p>
      </div>
    </div>
  );
}
