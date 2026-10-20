import os, sys, json
os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"]=str(2**40)
import cv2, numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
R="temp/"
IM="/path/to/screenshots/"
PAIRS={"surf":(IM+"2.png",R+"lands-between-surface.png"),"under":(IM+"4.png",R+"lands-between-underground.jpg"),"dlc":(IM+"6.png",R+"shadow-of-erd-tree.png")}
def load(p):
    im=Image.open(p).convert("RGBA"); a=np.array(im); 
    rgb=a[...,:3].astype(np.float32)*(a[...,3:4].astype(np.float32)/255.0)  # composite on black
    return rgb.astype(np.uint8)
out={}
for k,(old_p,new_p) in PAIRS.items():
    old=load(old_p); new=load(new_p)
    oh,ow=old.shape[:2]; nh,nw=new.shape[:2]
    # shrink the new image to roughly the old size for feature matching, remember the pre-scale
    f=ow/nw
    small=cv2.resize(new,(ow,int(round(nh*f))),interpolation=cv2.INTER_AREA)
    g1=cv2.cvtColor(old,cv2.COLOR_RGB2GRAY); g2=cv2.cvtColor(small,cv2.COLOR_RGB2GRAY)
    sift=cv2.SIFT_create(nfeatures=12000)
    k1,d1=sift.detectAndCompute(g1,None); k2,d2=sift.detectAndCompute(g2,None)
    m=cv2.BFMatcher().knnMatch(d2,d1,k=2)
    good=[a for a,b in m if a.distance<0.7*b.distance]
    src=np.float32([k2[a.queryIdx].pt for a in good]); dst=np.float32([k1[a.trainIdx].pt for a in good])  # small(new) -> old
    A,inl=cv2.estimateAffine2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=1.0,maxIters=5000,confidence=0.999)
    res=np.linalg.norm((src@A[:,:2].T+A[:,2])-dst,axis=1)[inl.ravel()==1]
    # compose: new full-res px -> small px (scale f) -> old px
    Af=np.vstack([A,[0,0,1]])@np.diag([f,f,1.0])
    inv=np.linalg.inv(Af)  # old px -> new px
    print(k,"old",(ow,oh),"new",(nw,nh),"matches",len(good),"inliers",int(inl.sum()),"median res %.3f max %.3f"%(np.median(res),res.max()))
    print("  new->old affine",np.round(Af[:2],5).tolist())
    print("  old->new affine",np.round(inv[:2],5).tolist())
    out[k]={"old_to_new":inv[:2].tolist(),"new_size":[nw,nh],"old_size":[ow,oh],"inliers":int(inl.sum()),"median_res_old_px":float(np.median(res))}
json.dump(out,open("align.json","w"),indent=1)
