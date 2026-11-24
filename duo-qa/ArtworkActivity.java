package review.duo.artcheck;

import android.app.Activity;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.os.Handler;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Render three player selections from the installed production APK at a QA-only origin. */
public final class ArtworkActivity extends Activity {
    private static final String ORIGIN = "https://widget-fixture.example";
    private static final String TAG = "DuoArtworkQA";
    private static final String[] THEMES = {"classic", "sunset", "sunset"};
    private static final String[] SKINS = {"classic", "classic", "ruby"};
    private final long[] previous = new long[2];
    private final Handler handler = new Handler();
    private WebView web;
    private AssetManager assets;
    private android.content.res.Resources gameResources;
    private final java.util.Map<String,Integer> launcherImages = new java.util.HashMap<>();
    private int scenario;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            gameResources = getPackageManager().getResourcesForApplication("ru.mathclicker.duo");
            assets = gameResources.getAssets();
            android.content.pm.PackageInfo app = getPackageManager().getPackageInfo("ru.mathclicker.duo",android.content.pm.PackageManager.GET_ACTIVITIES | android.content.pm.PackageManager.GET_DISABLED_COMPONENTS);
            for(android.content.pm.ActivityInfo activity:app.activities) {
                if(!"ru.mathclicker.duo.ClickerHostActivity".equals(activity.targetActivity) || activity.icon==0) continue;
                String id;
                if("ru.mathclicker.duo.ClickerActivity".equals(activity.name)) id="default";
                else if(activity.name.startsWith("ru.mathclicker.duo.launcher.Icon_")) id=activity.name.substring("ru.mathclicker.duo.launcher.Icon_".length());
                else continue;
                launcherImages.put(id.toLowerCase(java.util.Locale.ROOT)+".webp",activity.icon);
            }
        } catch (Exception e) { Log.e(TAG, "FAIL app assets", e); return; }
        web = new WebView(this);
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setAllowFileAccess(false);
        web.addJavascriptInterface(new Probe(), "ArtworkQA");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                String path = req.getUrl().getPath();
                if ("widget-fixture.example".equals(req.getUrl().getHost()) && path != null && !path.contains("..")) {
                    try {
                        if (path.startsWith("/seed/")) {
                            int i = Integer.parseInt(path.substring(6));
                            String page = "<script>localStorage.setItem('integrals.duomax.progress.v1',JSON.stringify({version:1,balance:1000020,totalEarned:1000020,clicks:1050,progress:{trainingGuideComplete:true}}));"
                                + "localStorage.setItem('mathclicker.duo.appearance.v1',JSON.stringify({themes:'" + THEMES[i] + "',skins:'" + SKINS[i] + "'}));"
                                + "location.replace('/assets/index.html?qa=" + i + "')</script>";
                            return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream(page.getBytes(StandardCharsets.UTF_8)));
                        }
                        if (path.startsWith("/assets/art/launcher/")) {
                            Integer image=launcherImages.get(path.substring("/assets/art/launcher/".length()));
                            if(image!=null)return new WebResourceResponse("image/webp",null,gameResources.openRawResource(image));
                        }
                        if (path.startsWith("/assets/")) {
                            String suffix = path.substring(path.lastIndexOf('.')+1);
                            String type = suffix.equals("js") ? "application/javascript" : android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(suffix);
                            return new WebResourceResponse(type == null ? "application/octet-stream" : type, null, assets.open(path.substring(8)));
                        }
                    } catch (Exception problem) { Log.w(TAG, "Read " + path + " " + problem); }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Missing", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
        });
        runScenario();
    }

    private void runScenario() {
        web.loadUrl(ORIGIN + "/seed/" + scenario);
        if (getIntent().getBooleanExtra("galleryOnly",false)) handler.postDelayed(this::galleryReady,600);
        else handler.postDelayed(this::awaitApp, 600);
    }

    private void galleryReady() {
        String code="(function(){if(!window.App||document.querySelector('#launch-screen'))return false;App.route('appearance');return true;})()";
        web.evaluateJavascript(code, ret->{
            if (!"true".equals(ret)) {handler.postDelayed(this::galleryReady,350);return;}
            handler.postDelayed(()->pickTile(false),550);
        });
    }

    private void touch(float x,float y) {
        long start=android.os.SystemClock.uptimeMillis();
        android.view.MotionEvent down=android.view.MotionEvent.obtain(start,start,android.view.MotionEvent.ACTION_DOWN,x,y,0);
        down.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
        web.dispatchTouchEvent(down);down.recycle();
        handler.postDelayed(()->{
            android.view.MotionEvent up=android.view.MotionEvent.obtain(start,android.os.SystemClock.uptimeMillis(),android.view.MotionEvent.ACTION_UP,x,y,0);
            up.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
            web.dispatchTouchEvent(up);up.recycle();
        },65);
    }

    private void pickTile(boolean icon) {
        String kind=icon?"icons":"themes";
        String code="(function(){var g=document.querySelector('.ap-grid[data-kind="+kind+"]');if(!g)return ['no grid'];var gr=g.getBoundingClientRect(),bs=g.querySelectorAll('.ap-card');"
            +"for(var i=0;i<bs.length;i++){var b=bs[i],st=b.dataset.state;if(st!=='open'&&st!=='spark'"+(icon?"&&st!=='check'":"")+")continue;"
            +"var r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,e=document.elementFromPoint(x,y);"
            +"if(gr.width>=60&&gr.height>=60&&r.width>=28&&r.height>=28&&x>=gr.left&&x<gr.right&&y>gr.top&&y<gr.bottom&&e&&e.closest('.ap-card')===b)"
            +"return [b.dataset.id,x,y,innerWidth,gr.width,gr.height,r.width,r.height];}return ['no reachable unlocked tile',bs.length,gr.width,gr.height];})()";
        web.evaluateJavascript(code,ret->{
            try {
                org.json.JSONArray j=new org.json.JSONArray(ret);
                if(j.length()!=8) throw new Exception(kind+" gallery not accessible "+ret);
                String id=j.getString(0);
                float scale=web.getWidth()/(float)j.getDouble(3);
                Log.i(TAG,"Gallery "+kind+" "+ret);
                touch((float)j.getDouble(1)*scale,(float)j.getDouble(2)*scale);
                handler.postDelayed(()->checkPreview(icon,id),450);
            }catch(Exception e){Log.e(TAG,"FAIL "+e.getMessage(),e);}
        });
    }

    private void checkPreview(boolean icon,String id) {
        String code="(function(){var p=document.querySelector('.ap-detail:not([hidden]) .ap-preview'),b=document.querySelector('.ap-grid .ap-card[aria-pressed=true]'),a=document.querySelector('.ap-use'),i=p&&p.querySelector('.ap-icon-preview');"
            +"if(!p||!b||!a)return ['missing preview'];var r=p.getBoundingClientRect();return [b.dataset.id,p.dataset.kind,r.width,r.height,a.disabled,i?i.naturalWidth:0];})()";
        web.evaluateJavascript(code,ret->{
            try {
                org.json.JSONArray j=new org.json.JSONArray(ret);
                if(j.length()!=6||!id.equals(j.getString(0))||j.getDouble(2)<30||j.getDouble(3)<30||!j.getString(1).equals(icon?"icons":"themes")||(!icon&&j.getBoolean(4))||(icon&&j.getInt(5)<1))throw new Exception("Invalid selected preview "+ret+" expected "+id);
                Log.i(TAG,"Selected preview "+ret);
                if(icon){String orientation=getResources().getConfiguration().orientation==android.content.res.Configuration.ORIENTATION_LANDSCAPE?"landscape":"portrait";Log.i(TAG,"PASS gallery "+orientation+" selectable theme and icon previews");return;}
                String close = "(function(){var b=document.querySelector('.ap-detail:not([hidden]) .ap-detail-close');if(!b||b.hidden||innerWidth>innerHeight)return null;var r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth]})()";
                web.evaluateJavascript(close, coords->{
                    try {
                        if(!"null".equals(coords)){org.json.JSONArray a=new org.json.JSONArray(coords);float scale=web.getWidth()/(float)a.getDouble(2);touch((float)a.getDouble(0)*scale,(float)a.getDouble(1)*scale);}
                        handler.postDelayed(this::switchToIcons,260);
                    }catch(Exception e){Log.e(TAG,"FAIL close "+e.getMessage(),e);}
                });
            }catch(Exception e){Log.e(TAG,"FAIL "+e.getMessage(),e);}
        });
    }

    private void switchToIcons() {
        String code="(function(){var b=document.querySelector('.ap-tabs > button:nth-child(3)'),r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,e=document.elementFromPoint(x,y);return [x,y,innerWidth,e&&e.closest('button')===b]})()";
        web.evaluateJavascript(code,coords->{
            try {
                org.json.JSONArray a=new org.json.JSONArray(coords);
                if(!a.getBoolean(3))throw new Exception("Icon tab is covered "+coords);
                float scale=web.getWidth()/(float)a.getDouble(2);
                touch((float)a.getDouble(0)*scale,(float)a.getDouble(1)*scale);
                handler.postDelayed(()->pickTile(true),600);
            }catch(Exception e){Log.e(TAG,"FAIL category "+e.getMessage(),e);}
        });
    }

    private void awaitApp() {
        String code = "(function(){if(location.search!=='?qa=" + scenario + "'||!window.App||!window.Appearance||document.querySelector('#launch-screen'))return false;"
            + "if(window.qaStarted)return true;window.qaStarted=1;"
            + "Appearance.widgetArtwork().then(x=>ArtworkQA.capture(x.theme,x.skin,x.background,x.button)).catch(e=>ArtworkQA.error(String(e)));return true;})()";
        web.evaluateJavascript(code, ret -> { if (!"true".equals(ret)) handler.postDelayed(this::awaitApp, 300); });
    }

    private Bitmap decode(String png, int w, int h) {
        String prefix="data:image/png;base64,";
        if (png == null || !png.startsWith(prefix)) throw new IllegalStateException("PNG data URI missing");
        byte[] bytes = Base64.decode(png.substring(prefix.length()), Base64.DEFAULT);
        Bitmap b = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (b == null || b.getWidth() != w || b.getHeight() != h) throw new IllegalStateException("Wrong bitmap size");
        return b;
    }

    private long fingerprint(Bitmap bitmap) {
        long hash = 1;
        for (int y = 0; y < bitmap.getHeight(); y += 3)
            for (int x = 0; x < bitmap.getWidth(); x += 3) hash = 31 * hash + bitmap.getPixel(x,y);
        return hash;
    }

    private String hostSample(Bitmap bitmap) {
        long hash = 1;
        for (int y=0;y<7;y++) for (int x=0;x<13;x++) {
            int px=(x*2+1)*bitmap.getWidth()/26, py=(y*2+1)*bitmap.getHeight()/14;
            hash=31*hash+bitmap.getPixel(px,py);
        }
        return bitmap.getWidth() + "x" + bitmap.getHeight() + "-" + Long.toHexString(hash);
    }

    public final class Probe {
        @JavascriptInterface public void error(String why) { Log.e(TAG,"FAIL JS " + why); }
        @JavascriptInterface public void capture(String theme,String skin,String bg,String art) {
            try {
                if (!THEMES[scenario].equals(theme) || !SKINS[scenario].equals(skin)) throw new IllegalStateException("Wrong game selection " + theme + "/" + skin);
                Bitmap back = decode(bg,640,240), disk = decode(art,160,160);
                if ((disk.getPixel(0,0) >>> 24) != 0 || (disk.getPixel(80,80) >>> 24) < 220) throw new IllegalStateException("Button alpha");
                if (scenario==0) {
                    String sample = hostSample(back) + "/" + hostSample(disk);
                    String expected = getIntent().getStringExtra("hostArtwork");
                    if (sample.equals(expected)) Log.i(TAG, "MATCH production RemoteViews pixels match selected in-game art " + sample);
                    else Log.i(TAG, "Comparison for default fallback or color conversion: host=" + expected + ", WebView=" + sample);
                }
                long backHash=fingerprint(back), diskHash=fingerprint(disk);
                if (scenario==1 && (previous[0]==backHash || previous[1]!=diskHash)) throw new IllegalStateException("Theme-only change did not alter only background");
                if (scenario==2 && (previous[0]!=backHash || previous[1]==diskHash)) throw new IllegalStateException("Skin-only change did not alter only button");
                previous[0]=backHash; previous[1]=diskHash;
                Log.i(TAG,"Images " + theme + "/" + skin + " = " + Long.toHexString(backHash) + "/" + Long.toHexString(diskHash));
                if (scenario==2) { Log.i(TAG,"PASS independently changed background and integral skin from final APK on Android WebView"); return; }
                ++scenario;
                runOnUiThread(ArtworkActivity.this::runScenario);
            } catch (Exception e) { Log.e(TAG,"FAIL " + e.getMessage(),e); }
        }
    }
}
