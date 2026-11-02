package android.webkit;

/**
 * Compile-time stub only (API 26 class, we compile against android-23).
 * It is never packaged: build.sh puts it on the javac classpath, not in the dex.
 * On API 26+ the real framework class is used; below 26 the callback is never invoked.
 */
public abstract class RenderProcessGoneDetail {
    public abstract boolean didCrash();
    public abstract int rendererPriorityAtExit();
}
