package review.duo.touchcheck;

import android.app.Activity;
import android.content.res.AssetManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.SystemClock;
import android.util.Log;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;

public final class TwoFingerActivity extends Activity {
    private final Handler handler = new Handler();
    private static final String ORIGIN = "https://fixture.example/";
    private WebView web;
    private AssetManager game;
    private long down;
    private int polls;
    private boolean portrait;
    private boolean failed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        portrait=getIntent().getBooleanExtra("portraitMenu",false);
        try {
            game = getPackageManager().getResourcesForApplication("ru.mathclicker.duo").getAssets();
        } catch (Exception e) { fail(e); return; }
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setSupportZoom(false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    Log.w("DuoTouchQA", m.sourceId() + ":" + m.lineNumber() + " " + m.message());
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
                String path = request.getUrl().getPath();
                try {
                    if (!request.getUrl().toString().startsWith(ORIGIN) || path == null || path.contains(".."))
                        throw new IllegalArgumentException();
                    if (path.equals("/seed")) {
                        String page = "<script>localStorage.setItem('integrals.duomax.progress.v1',JSON.stringify({version:1,balance:5000,clicks:125,totalEarned:5015,counts:{autoclick:1},discoveries:['autoclick','abacus'],progress:{trainingGuideComplete:true}}));location.replace('/assets/index.html')</script>";
                        return new WebResourceResponse("text/html","utf-8",new ByteArrayInputStream(page.getBytes(StandardCharsets.UTF_8)));
                    }
                    String type = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(path.substring(path.lastIndexOf('.')+1));
                    if (path.endsWith(".js")) type = "application/javascript";
                    if (path.startsWith("/assets/"))
                        return new WebResourceResponse(type == null ? "application/octet-stream" : type, null, game.open(path.substring(8)));
                } catch (Exception ignored) {}
                return new WebResourceResponse("text/plain","utf-8",404,"Missing",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
            }
        });
        setContentView(web);
        web.loadUrl(ORIGIN+"seed");
        handler.postDelayed(this::ready, 1200);
    }
    private void fail(Exception e) { failed=true;Log.e("DuoTouchQA","FAIL " + e.getMessage(),e); }
    private void ready() {
        String probe="(function(){if(!window.App||!window.Economy||document.querySelector('#launch-screen'))return null;if(App.activeRoute!=='resources')App.route('resources');"
            +"function center(id){var e=document.querySelector('[data-row='+id+'] .pg-resource-heading strong')||document.querySelector('[data-page-action=buy][data-key='+id+']');if(!e)return null;var r=e.getBoundingClientRect();return [r.left+r.width*.38,r.top+r.height/2];}"
            +"return [innerWidth,center('autoclick'),center('abacus'),Economy.owned('autoclick'),Economy.owned('abacus')];})()";
        web.evaluateJavascript(probe, ret -> {
            if (ret == null || ret.equals("null")) {
                if (++polls<70) handler.postDelayed(this::ready,500);
                else fail(new Exception("Timed out loading final game in QA WebView")); return;
            }
            try {
                JSONArray j = new JSONArray(ret);
                if (portrait){web.evaluateJavascript("App.route('home')", v->handler.postDelayed(()->menuEdge(0),250));return;}
                final float ratio = web.getWidth() / (float)j.getDouble(0);
                final float[][] pts = new float[2][2];
                for(int i=0;i<2;i++) for(int a=0;a<2;a++) pts[i][a]=(float)j.getJSONArray(i+1).getDouble(a)*ratio;
                if (j.getInt(3)!=1||j.getInt(4)!=0) throw new Exception("Unexpected initial counts " + ret);
                Log.i("DuoTouchQA","Tap headers at "+ret);
                down=SystemClock.uptimeMillis();
                motion(MotionEvent.ACTION_DOWN,new int[]{0},pts);
                handler.postDelayed(()->motion(MotionEvent.ACTION_POINTER_DOWN|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),new int[]{0,1},pts),55);
                handler.postDelayed(()->motion(MotionEvent.ACTION_POINTER_UP,new int[]{0,1},pts),130);
                handler.postDelayed(()->motion(MotionEvent.ACTION_UP,new int[]{1},pts),195);
                handler.postDelayed(()->verify(pts),1000);
            } catch(Exception e) {fail(e);}
        });
    }
    private void verify(float[][] pts) {
        web.evaluateJavascript("[Economy.owned('autoclick'),Economy.owned('abacus'),App.activeRoute,visualViewport.scale]", ret->{
            try {
                JSONArray j = new JSONArray(ret);
                if(j.getInt(0)!=2||j.getInt(1)!=1||!j.getString(2).equals("resources")||Math.abs(j.getDouble(3)-1)>.001) throw new Exception("Unexpected double contact result " + ret);
                down=SystemClock.uptimeMillis();
                motion(MotionEvent.ACTION_DOWN,new int[]{0},pts);
                handler.postDelayed(()->{pts[0][1]-=125;motion(MotionEvent.ACTION_MOVE,new int[]{0},pts);},65);
                handler.postDelayed(()->{pts[0][1]-=95;motion(MotionEvent.ACTION_MOVE,new int[]{0},pts);},110);
                handler.postDelayed(()->motion(MotionEvent.ACTION_UP,new int[]{0},pts),160);
                handler.postDelayed(()->web.evaluateJavascript("[Economy.owned('autoclick'),Economy.owned('abacus'),document.querySelector('.pg-list').scrollTop]", r->{
                    try {JSONArray a=new JSONArray(r);if(a.getInt(0)!=2||a.getInt(1)!=1||a.getDouble(2)<=0)throw new Exception("Scroll or purchase cancellation failed "+r);
                        Log.i("DuoTouchQA","Confirmed both resource purchases and ordinary scrolling " + r);
                        pinch(false);
                    }catch(Exception e){fail(e);}
                }),1000);
            } catch(Exception e){fail(e);}
        });
    }
    private String viewport() {
        return "[innerWidth,innerHeight,visualViewport.width,visualViewport.height,visualViewport.scale]";
    }
    private void checkViewport(JSONArray before, JSONArray after) throws Exception {
        for (int i=0;i<5;i++) {
            if (Math.abs(before.getDouble(i)-after.getDouble(i))>(i==4?.001:.6))
                throw new Exception("Page viewport changed at index "+i+" "+before+" → "+after);
        }
        if (Math.abs(after.getDouble(4)-1)>.001) throw new Exception("Unexpected page scale "+after);
    }
    private void pinch(boolean map) {
        final String route=map?"world":"home";
        web.evaluateJavascript("App.route('"+route+"')",ret -> handler.postDelayed(()->{
            String geometry="(function(){var el=document.querySelector('"+(map?".wm-surface":"#home")+"'),r=el.getBoundingClientRect();"
                +"var school=document.querySelector('.wm-target[data-index=\"0\"]'),building=school?school.getBoundingClientRect():r;"
                +"var x=Math.max(r.left+r.width*.26,Math.min(r.right-r.width*.26,building.left+building.width*.5));"
                +"var y="+(map?"Math.max(r.top+r.height*.23,Math.min(r.bottom-r.height*.20,building.top+building.height*.5))":"r.top+r.height*.24")+";"
                +"var span=r.width*.055, targets=[document.elementFromPoint(x-span,y),document.elementFromPoint(x+span,y)];"
                +"var debug={rect:[r.left,r.top,r.width,r.height],hits:targets.map(function(n){return n?n.tagName+'.'+n.className:'null'}),"
                +"owned:targets.every(function(n){return el.contains(n)}),inset:CSS.supports('inset','0'),ua:navigator.userAgent};"
                +(map?"window.qaPinchTrace=[];['pointerdown','pointermove','pointerup','pointercancel'].forEach(function(k){el.addEventListener(k,function(e){if(window.qaPinchTrace.length<32)window.qaPinchTrace.push([k,e.pointerId,e.button,e.clientX,e.clientY]);},{capture:true,passive:true});});":"")
                +"return ["+viewport()+",x,y,span,"+(map?"new DOMMatrix(getComputedStyle(document.querySelector('.wm-board')).transform).a":"0")+",debug,"
                +(map?"document.querySelector('.wm-ground').getBoundingClientRect().width":"0")+"];})()";
            web.evaluateJavascript(geometry,result->{
                try {
                    JSONArray g=new JSONArray(result), before=g.getJSONArray(0);
                    Log.i("DuoTouchQA",route+" pinch geometry "+g.getJSONObject(5));
                    JSONArray rect=g.getJSONObject(5).getJSONArray("rect");
                    if(rect.getDouble(2)<=0 || rect.getDouble(3)<=0 || !g.getJSONObject(5).getBoolean("owned"))
                        throw new Exception(route+" does not own two tappable points: "+g);
                    float px=web.getWidth()/(float)before.getDouble(0);
                    float x=(float)g.getDouble(1)*px,y=(float)g.getDouble(2)*px,span=(float)g.getDouble(3)*px;
                    float[][] p={{x-span,y},{x+span,y}};
                    down=SystemClock.uptimeMillis();
                    motion(MotionEvent.ACTION_DOWN,new int[]{0},p);
                    handler.postDelayed(()->motion(MotionEvent.ACTION_POINTER_DOWN|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),new int[]{0,1},p),45);
                    for(int i=1;i<=6;i++){
                        final int step=i;
                        handler.postDelayed(()->{
                            float distance=span*(1+step*.4f);
                            p[0][0]=x-distance;p[1][0]=x+distance;
                            motion(MotionEvent.ACTION_MOVE,new int[]{0,1},p);
                        },55+35*i);
                    }
                    // Sample while both fingers are still on the glass; a host
                    // which snaps back to 1x on release must also fail.
                    handler.postDelayed(()->web.evaluateJavascript(viewport(),during->{
                        try{checkViewport(before,new JSONArray(during));}catch(Exception e){fail(e);}
                    }),310);
                    handler.postDelayed(()->motion(MotionEvent.ACTION_POINTER_UP|(1<<MotionEvent.ACTION_POINTER_INDEX_SHIFT),new int[]{0,1},p),375);
                    handler.postDelayed(()->{p[0][0]+=span*.28f;motion(MotionEvent.ACTION_MOVE,new int[]{0},p);},420);
                    handler.postDelayed(()->motion(MotionEvent.ACTION_UP,new int[]{0},p),465);
                    final double baseline=g.getDouble(4);
                    final double groundWidth=g.getDouble(6);
                    handler.postDelayed(()->finishPinch(map,before,baseline,groundWidth),850);
                }catch(Exception e){fail(e);}
            });
        },400));
    }
    private void finishPinch(boolean map,JSONArray before,double baseline,double groundWidth) {
        String check="["+viewport()+",App.activeRoute,App.sheet,document.querySelector('.pg-pane[data-detail]')!==null,"
            +(map?"new DOMMatrix(getComputedStyle(document.querySelector('.wm-board')).transform).a,document.querySelector('.wm-ground').getBoundingClientRect().width,window.qaPinchTrace":"0,0,[]")+"]";
        web.evaluateJavascript(check,result->{
            try{
                JSONArray r=new JSONArray(result);
                checkViewport(before,r.getJSONArray(0));
                if (!r.getString(1).equals(map?"world":"home")||!r.getString(2).isEmpty()||r.getBoolean(3))
                    throw new Exception("Pinch activated a different control: "+result);
                if(!map){pinch(true);return;}
                double ratio=r.getDouble(4)/baseline;
                if(!(ratio>1.15 && groundWidth>0 && r.getDouble(5)/groundWidth>1.15))
                    throw new Exception("World map did not zoom: board="+baseline+" -> "+r.getDouble(4)
                        +", visible ground width="+groundWidth+" -> "+r.getDouble(5)+", OS pointer events="+r.getJSONArray(6));
                verifyMapTap(ratio);
            }catch(Exception e){fail(e);}
        });
    }
    private void verifyMapTap(double ratio){
        String coords="(function(){var b=document.querySelector('.wm-target[data-index=\"0\"]').getBoundingClientRect();"
            +"return [innerWidth,b.x+b.width/2,b.y+b.height/2];})()";
        web.evaluateJavascript(coords,result->{
            try{
                JSONArray r=new JSONArray(result);
                float px=web.getWidth()/(float)r.getDouble(0);
                float[][] p={{(float)r.getDouble(1)*px,(float)r.getDouble(2)*px}};
                down=SystemClock.uptimeMillis();motion(MotionEvent.ACTION_DOWN,new int[]{0},p);
                handler.postDelayed(()->motion(MotionEvent.ACTION_UP,new int[]{0},p),75);
                handler.postDelayed(()->web.evaluateJavascript("!!document.querySelector('.pg-pane[data-detail=district] [data-page-action=quests][data-key=school]')",opened->{
                    if(failed)return;
                    if("true".equals(opened)){Log.i("DuoTouchQA","Two OS fingers bought exactly one of each, viewport stayed fixed, map zoomed "+ratio+"x and next tap opened school");web.evaluateJavascript("App.route('home')", v -> handler.postDelayed(()->menuEdge(0),200));}
                    else fail(new Exception("School did not respond to a single tap after pinch"));
                }),460);
            }catch(Exception e){fail(e);}
        });
    }
    private void menuEdge(int test){
        // Sample the whole visible bar independently of the element hit rectangles.
        String[] tabs={"research","resources","home","world","appearance"};
        String[] actions={"honors","profile","help"};
        if(test==13){Log.i("DuoTouchQA",portrait?"PASS portrait menu edges":"PASS landscape menu edges, two concurrent purchases, scroll cancellation and map pinch");return;}
        boolean header=test>=10;
        String name=header?actions[test-10]:tabs[test%5];
        String expr=header
            ?"var b=document.querySelector('.head-actions [data-sheet="+name+"]'),r=b.getBoundingClientRect();var x=r.right-5,y=r.top+5;"
            :"var r=document.getElementById('tabs').getBoundingClientRect(),w=r.width/5;var x=r.left+w*"+(test%5)+(test<5?"+5":"+w-5")+",y="+(test<5?"r.top+5":"r.bottom-5")+";";
        String trace="window.qaEdge=[];if(!window.qaEdgeWatch){window.qaEdgeWatch=true;['pointerdown','pointerup','click'].forEach(function(type){document.addEventListener(type,function(e){"
            +"var el=e.target.closest('[data-route],[data-sheet]'),at=document.elementFromPoint(e.clientX,e.clientY),atB=at&&at.closest('[data-route],[data-sheet]');"
            +"window.qaEdge.push([e.type,el&&(el.dataset.route||el.dataset.sheet),atB&&(atB.dataset.route||atB.dataset.sheet),Math.round(e.clientX),Math.round(e.clientY),Math.round(performance.now())]);},true);});}";
        web.evaluateJavascript("(function(){"+trace+expr+"var t=document.elementFromPoint(x,y),b0=t&&t.closest('[data-route],[data-sheet]');return [innerWidth,innerHeight,x,y,b0&&(b0.dataset.route||b0.dataset.sheet),t&&t.className]})()", v->{
            try{
                JSONArray a=new JSONArray(v);
                if((a.getInt(0)<a.getInt(1))!=portrait)throw new Exception("Unexpected viewport "+v);
                if(!name.equals(a.optString(4)))throw new Exception("Menu geometry edge "+test+" expected "+name+" actual " +v);
                float f=web.getWidth()/(float)a.getDouble(0);
                float[][] p={{(float)a.getDouble(2)*f,(float)a.getDouble(3)*f}};
                down=SystemClock.uptimeMillis();
                motion(MotionEvent.ACTION_DOWN,new int[]{0},p);
                handler.postDelayed(()->motion(MotionEvent.ACTION_UP,new int[]{0},p),68);
                handler.postDelayed(()->confirmEdge(test,header,name,v,SystemClock.uptimeMillis()+1050),205);
            }catch(Exception ex){fail(ex);}
        });
    }
    private void confirmEdge(int test,boolean header,String name,String before,long deadline) {
        String state=header?"App.sheet":"App.activeRoute";
        web.evaluateJavascript("["+state+",window.qaEdge]", raw->{
            try {
                JSONArray result=new JSONArray(raw);
                if(name.equals(result.optString(0))) {
                    if(header)web.evaluateJavascript("App.closeSheet()",out->handler.postDelayed(()->menuEdge(test+1),150));
                    else menuEdge(test+1);
                    return;
                }
                if(SystemClock.uptimeMillis()<deadline) {
                    handler.postDelayed(()->confirmEdge(test,header,name,before,deadline),85);
                    return;
                }
                fail(new Exception("Single menu touch expected "+name+" at "+before+" observed "+raw));
            }catch(Exception e){fail(e);}
        });
    }

    private void motion(int action,int[] ids,float[][] points) {
        MotionEvent.PointerProperties[] prop=new MotionEvent.PointerProperties[ids.length];
        MotionEvent.PointerCoords[] coords=new MotionEvent.PointerCoords[ids.length];
        for (int i=0;i<ids.length;i++){
            int id=ids[i];
            prop[i]=new MotionEvent.PointerProperties();prop[i].id=id;prop[i].toolType=MotionEvent.TOOL_TYPE_FINGER;
            coords[i]=new MotionEvent.PointerCoords();coords[i].x=points[id][0];coords[i].y=points[id][1];coords[i].pressure=1;coords[i].size=.08f;
        }
        MotionEvent e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,ids.length,prop,coords,0,0,1,1,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);
        web.dispatchTouchEvent(e);e.recycle();
    }
}
