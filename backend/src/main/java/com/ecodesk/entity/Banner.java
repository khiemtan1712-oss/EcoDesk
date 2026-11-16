package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "banners")
public class Banner {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(length = 255)
    private String subtitle;

    @Column(length = 50)
    private String badge;

    @Column(length = 255)
    private String link;

    @Column(length = 500)
    private String image;

    private Boolean active = true;

    public Banner() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSubtitle() {
        return subtitle;
    }

    public void setSubtitle(String subtitle) {
        this.subtitle = subtitle;
    }

    public String getBadge() {
        return badge;
    }

    public void setBadge(String badge) {
        this.badge = badge;
    }

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
